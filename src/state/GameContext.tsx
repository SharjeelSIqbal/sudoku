/**
 * The game in play.
 *
 * Two things here are deliberate and easy to undo by accident:
 *
 * 1. The hard-mode toggles are captured into the game when it starts, not read
 *    from settings when it is scored. Reading them at scoring time would let a
 *    player flip a switch mid-game and rewrite their own multiplier.
 * 2. Move justification runs *after* the move has rendered. Judging a guess
 *    means running the technique ladder, and no keystroke should ever wait on
 *    that — so a placement is recorded immediately and its verdict reconciled
 *    a tick later.
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  type ReactNode,
} from 'react';

import {
  boardFromDigits,
  countCandidates,
  maskOfDigit,
  recomputeCandidates,
} from '../game/board';
import { findNextHint } from '../game/grading';
import { judgePlacement } from '../game/justification';
import { computeScore, type ScoreBreakdown } from '../game/scoring';
import {
  CELL_COUNT,
  EMPTY_CELL,
  type Board,
  type Difficulty,
  type Digit,
  type PlayMode,
  type SolveStep,
} from '../game/types';
import { clearGameSnapshot, saveGameSnapshot, type SavedGameSnapshot } from '../data/savedGame';
import { dayKeyOf } from '../utils/dates';
import { runWhenIdle } from '../utils/scheduling';

/** Wrong entries allowed before the run ends, when the strike limit is on. */
export const MAX_STRIKES = 3;

export type GameStatus = 'playing' | 'won' | 'lost';

interface UndoEntry {
  cellIndex: number;
  previousDigit: number;
  previousMarks: number;
}

export interface ActiveGame {
  seed: string;
  difficulty: Difficulty;
  mode: PlayMode;
  isDailyChallenge: boolean;
  givens: Uint8Array;
  solution: Uint8Array;
  /** The player's own entries; givens are not repeated here. */
  entries: Uint8Array;
  pencilMarks: Uint16Array;
  selectedCellIndex: number | null;
  /** Only meaningful in digit-first input. */
  selectedDigit: Digit | null;
  isPencilMode: boolean;
  status: GameStatus;
  elapsedSeconds: number;
  startedAt: string;
  wrongEntryCount: number;
  repeatedWrongEntryCount: number;
  unjustifiedPlacementCount: number;
  hintCount: number;
  strikeCount: number;
  previouslyWrongCells: number[];
  /** Cells currently holding a wrong digit — only tracked when validating. */
  conflictedCells: number[];
  instantValidationEnabled: boolean;
  strikeLimitEnabled: boolean;
  autoCandidatesUsed: boolean;
  activeHint: SolveStep | null;
  undoStack: UndoEntry[];
  /** Placements awaiting a justification verdict. */
  pendingJudgements: { cellIndex: number; digit: Digit; entriesBefore: number[] }[];
}

export interface StartGameInput {
  seed: string;
  difficulty: Difficulty;
  mode: PlayMode;
  isDailyChallenge: boolean;
  givens: Uint8Array;
  solution: Uint8Array;
  instantValidationEnabled: boolean;
  strikeLimitEnabled: boolean;
  autoCandidatesEnabled: boolean;
}

type GameAction =
  | { type: 'startGame'; input: StartGameInput }
  | { type: 'resumeGame'; game: ActiveGame }
  | { type: 'selectCell'; cellIndex: number }
  | { type: 'selectDigit'; digit: Digit | null }
  | { type: 'setPencilMode'; isPencilMode: boolean }
  | { type: 'enterDigit'; cellIndex: number; digit: Digit }
  | { type: 'togglePencilMark'; cellIndex: number; digit: Digit }
  | { type: 'eraseCell'; cellIndex: number }
  | { type: 'undo' }
  | { type: 'showHint'; hint: SolveStep | null }
  | { type: 'applyHint' }
  | { type: 'tick' }
  | { type: 'resolveJudgement'; cellIndex: number; wasGuess: boolean }
  | { type: 'clearGame' };

/** The full grid as the engine sees it: givens plus the player's entries. */
export function boardForGame(game: ActiveGame): Board {
  const digits = new Uint8Array(CELL_COUNT);
  for (let cellIndex = 0; cellIndex < CELL_COUNT; cellIndex += 1) {
    digits[cellIndex] =
      game.givens[cellIndex] !== EMPTY_CELL ? game.givens[cellIndex] : game.entries[cellIndex];
  }
  return boardFromDigits(digits);
}

function isCellGiven(game: ActiveGame, cellIndex: number): boolean {
  return game.givens[cellIndex] !== EMPTY_CELL;
}

function isGridComplete(game: ActiveGame): boolean {
  for (let cellIndex = 0; cellIndex < CELL_COUNT; cellIndex += 1) {
    const digit =
      game.givens[cellIndex] !== EMPTY_CELL ? game.givens[cellIndex] : game.entries[cellIndex];
    if (digit !== game.solution[cellIndex]) {
      return false;
    }
  }
  return true;
}

function autoFilledMarks(givens: Uint8Array, entries: Uint8Array): Uint16Array {
  const digits = new Uint8Array(CELL_COUNT);
  for (let cellIndex = 0; cellIndex < CELL_COUNT; cellIndex += 1) {
    digits[cellIndex] =
      givens[cellIndex] !== EMPTY_CELL ? givens[cellIndex] : entries[cellIndex];
  }
  const board = boardFromDigits(digits);
  recomputeCandidates(board);
  return board.candidates;
}

function withRefreshedMarks(game: ActiveGame): ActiveGame {
  if (!game.autoCandidatesUsed) {
    return game;
  }
  return { ...game, pencilMarks: autoFilledMarks(game.givens, game.entries) };
}

function createGame(input: StartGameInput): ActiveGame {
  const entries = new Uint8Array(CELL_COUNT);
  return {
    seed: input.seed,
    difficulty: input.difficulty,
    mode: input.mode,
    isDailyChallenge: input.isDailyChallenge,
    givens: input.givens,
    solution: input.solution,
    entries,
    pencilMarks: input.autoCandidatesEnabled
      ? autoFilledMarks(input.givens, entries)
      : new Uint16Array(CELL_COUNT),
    selectedCellIndex: null,
    selectedDigit: null,
    isPencilMode: false,
    status: 'playing',
    elapsedSeconds: 0,
    startedAt: new Date().toISOString(),
    wrongEntryCount: 0,
    repeatedWrongEntryCount: 0,
    unjustifiedPlacementCount: 0,
    hintCount: 0,
    strikeCount: 0,
    previouslyWrongCells: [],
    conflictedCells: [],
    instantValidationEnabled: input.instantValidationEnabled,
    strikeLimitEnabled: input.strikeLimitEnabled,
    autoCandidatesUsed: input.autoCandidatesEnabled,
    activeHint: null,
    undoStack: [],
    pendingJudgements: [],
  };
}

function applyEntry(game: ActiveGame, cellIndex: number, digit: Digit): ActiveGame {
  const isCorrect = game.solution[cellIndex] === digit;

  const entries = new Uint8Array(game.entries);
  const pencilMarks = new Uint16Array(game.pencilMarks);
  const undoEntry: UndoEntry = {
    cellIndex,
    previousDigit: entries[cellIndex],
    previousMarks: pencilMarks[cellIndex],
  };

  entries[cellIndex] = digit;
  pencilMarks[cellIndex] = 0;

  const hadBeenWrongHere = game.previouslyWrongCells.includes(cellIndex);

  let next: ActiveGame = {
    ...game,
    entries,
    pencilMarks,
    activeHint: null,
    undoStack: [...game.undoStack, undoEntry],
  };

  if (isCorrect) {
    next = {
      ...next,
      conflictedCells: next.conflictedCells.filter((cell) => cell !== cellIndex),
      // Judged after this renders — see the note at the top of the file.
      pendingJudgements: [
        ...next.pendingJudgements,
        { cellIndex, digit, entriesBefore: [...game.entries] },
      ],
    };
  } else {
    next = {
      ...next,
      wrongEntryCount: next.wrongEntryCount + 1,
      repeatedWrongEntryCount: hadBeenWrongHere
        ? next.repeatedWrongEntryCount + 1
        : next.repeatedWrongEntryCount,
      strikeCount: next.strikeCount + 1,
      previouslyWrongCells: hadBeenWrongHere
        ? next.previouslyWrongCells
        : [...next.previouslyWrongCells, cellIndex],
      // With validation off the player is not told, but the app still knows.
      conflictedCells: next.instantValidationEnabled
        ? [...new Set([...next.conflictedCells, cellIndex])]
        : next.conflictedCells,
    };
  }

  next = withRefreshedMarks(next);

  if (isGridComplete(next)) {
    return { ...next, status: 'won', selectedCellIndex: cellIndex };
  }
  if (next.strikeLimitEnabled && next.strikeCount >= MAX_STRIKES) {
    return { ...next, status: 'lost', selectedCellIndex: cellIndex };
  }

  return { ...next, selectedCellIndex: cellIndex };
}

function gameReducer(game: ActiveGame | null, action: GameAction): ActiveGame | null {
  if (action.type === 'startGame') {
    return createGame(action.input);
  }
  if (action.type === 'resumeGame') {
    return action.game;
  }
  if (action.type === 'clearGame') {
    return null;
  }
  if (game === null) {
    return game;
  }

  switch (action.type) {
    case 'selectCell':
      return { ...game, selectedCellIndex: action.cellIndex };

    case 'selectDigit':
      return { ...game, selectedDigit: action.digit };

    case 'setPencilMode':
      return { ...game, isPencilMode: action.isPencilMode };

    case 'enterDigit': {
      if (game.status !== 'playing' || isCellGiven(game, action.cellIndex)) {
        return game;
      }
      // Re-entering the digit already there is a no-op, not a fresh mistake.
      if (game.entries[action.cellIndex] === action.digit) {
        return game;
      }
      return applyEntry(game, action.cellIndex, action.digit);
    }

    case 'togglePencilMark': {
      if (
        game.status !== 'playing' ||
        isCellGiven(game, action.cellIndex) ||
        game.entries[action.cellIndex] !== EMPTY_CELL
      ) {
        return game;
      }
      const pencilMarks = new Uint16Array(game.pencilMarks);
      const undoEntry: UndoEntry = {
        cellIndex: action.cellIndex,
        previousDigit: game.entries[action.cellIndex],
        previousMarks: pencilMarks[action.cellIndex],
      };
      pencilMarks[action.cellIndex] ^= maskOfDigit(action.digit);
      return {
        ...game,
        pencilMarks,
        selectedCellIndex: action.cellIndex,
        undoStack: [...game.undoStack, undoEntry],
      };
    }

    case 'eraseCell': {
      if (game.status !== 'playing' || isCellGiven(game, action.cellIndex)) {
        return game;
      }
      const entries = new Uint8Array(game.entries);
      const pencilMarks = new Uint16Array(game.pencilMarks);
      if (entries[action.cellIndex] === EMPTY_CELL && pencilMarks[action.cellIndex] === 0) {
        return game;
      }
      const undoEntry: UndoEntry = {
        cellIndex: action.cellIndex,
        previousDigit: entries[action.cellIndex],
        previousMarks: pencilMarks[action.cellIndex],
      };
      entries[action.cellIndex] = EMPTY_CELL;
      pencilMarks[action.cellIndex] = 0;
      return withRefreshedMarks({
        ...game,
        entries,
        pencilMarks,
        conflictedCells: game.conflictedCells.filter((cell) => cell !== action.cellIndex),
        selectedCellIndex: action.cellIndex,
        undoStack: [...game.undoStack, undoEntry],
      });
    }

    case 'undo': {
      if (game.status !== 'playing' || game.undoStack.length === 0) {
        return game;
      }
      const undoStack = [...game.undoStack];
      const undoEntry = undoStack.pop()!;
      const entries = new Uint8Array(game.entries);
      const pencilMarks = new Uint16Array(game.pencilMarks);
      entries[undoEntry.cellIndex] = undoEntry.previousDigit;
      pencilMarks[undoEntry.cellIndex] = undoEntry.previousMarks;

      // Undo takes back the move, not the mistake: the counters that feed
      // scoring stay put, or undo would be a free eraser for penalties.
      return withRefreshedMarks({
        ...game,
        entries,
        pencilMarks,
        conflictedCells: game.conflictedCells.filter(
          (cell) => cell !== undoEntry.cellIndex,
        ),
        selectedCellIndex: undoEntry.cellIndex,
        undoStack,
      });
    }

    case 'showHint':
      return action.hint === null
        ? game
        : { ...game, activeHint: action.hint, hintCount: game.hintCount + 1 };

    case 'applyHint': {
      const placement = game.activeHint?.placements[0];
      if (game.status !== 'playing' || placement === undefined) {
        return game;
      }
      // A hinted placement is the app's reasoning, not the player's, so it is
      // not also charged the guess penalty — the hint penalty already applies.
      const applied = applyEntry(game, placement.cellIndex, placement.digit);
      return { ...applied, pendingJudgements: game.pendingJudgements };
    }

    case 'tick':
      return game.status === 'playing'
        ? { ...game, elapsedSeconds: game.elapsedSeconds + 1 }
        : game;

    case 'resolveJudgement':
      return {
        ...game,
        unjustifiedPlacementCount: action.wasGuess
          ? game.unjustifiedPlacementCount + 1
          : game.unjustifiedPlacementCount,
        pendingJudgements: game.pendingJudgements.filter(
          (judgement) => judgement.cellIndex !== action.cellIndex,
        ),
      };

    default:
      return game;
  }
}

function toSnapshot(game: ActiveGame): SavedGameSnapshot {
  const digitsToText = (digits: Uint8Array): string =>
    [...digits].map((digit) => (digit === EMPTY_CELL ? '.' : `${digit}`)).join('');

  return {
    seed: game.seed,
    difficulty: game.difficulty,
    mode: game.mode,
    isDailyChallenge: game.isDailyChallenge,
    givens: digitsToText(game.givens),
    solution: [...game.solution].join(''),
    entries: digitsToText(game.entries),
    pencilMarks: [...game.pencilMarks],
    elapsedSeconds: game.elapsedSeconds,
    wrongEntryCount: game.wrongEntryCount,
    repeatedWrongEntryCount: game.repeatedWrongEntryCount,
    unjustifiedPlacementCount: game.unjustifiedPlacementCount,
    hintCount: game.hintCount,
    strikeCount: game.strikeCount,
    previouslyWrongCells: game.previouslyWrongCells,
    instantValidationEnabled: game.instantValidationEnabled,
    strikeLimitEnabled: game.strikeLimitEnabled,
    autoCandidatesUsed: game.autoCandidatesUsed,
    startedAt: game.startedAt,
  };
}

export function gameFromSnapshot(snapshot: SavedGameSnapshot): ActiveGame {
  const textToDigits = (text: string): Uint8Array => {
    const digits = new Uint8Array(CELL_COUNT);
    for (let cellIndex = 0; cellIndex < CELL_COUNT; cellIndex += 1) {
      const character = text[cellIndex];
      digits[cellIndex] = character === '.' ? EMPTY_CELL : Number(character);
    }
    return digits;
  };

  return {
    seed: snapshot.seed,
    difficulty: snapshot.difficulty,
    mode: snapshot.mode,
    isDailyChallenge: snapshot.isDailyChallenge,
    givens: textToDigits(snapshot.givens),
    solution: textToDigits(snapshot.solution),
    entries: textToDigits(snapshot.entries),
    pencilMarks: Uint16Array.from(snapshot.pencilMarks),
    selectedCellIndex: null,
    selectedDigit: null,
    isPencilMode: false,
    status: 'playing',
    elapsedSeconds: snapshot.elapsedSeconds,
    startedAt: snapshot.startedAt,
    wrongEntryCount: snapshot.wrongEntryCount,
    repeatedWrongEntryCount: snapshot.repeatedWrongEntryCount,
    unjustifiedPlacementCount: snapshot.unjustifiedPlacementCount,
    hintCount: snapshot.hintCount,
    strikeCount: snapshot.strikeCount,
    previouslyWrongCells: snapshot.previouslyWrongCells,
    conflictedCells: [],
    instantValidationEnabled: snapshot.instantValidationEnabled,
    strikeLimitEnabled: snapshot.strikeLimitEnabled,
    autoCandidatesUsed: snapshot.autoCandidatesUsed,
    activeHint: null,
    undoStack: [],
    pendingJudgements: [],
  };
}

export interface FinishedGameSummary {
  game: ActiveGame;
  score: ScoreBreakdown;
  dayKey: string;
}

interface GameContextValue {
  game: ActiveGame | null;
  startGame: (input: StartGameInput) => void;
  resumeGame: (game: ActiveGame) => void;
  selectCell: (cellIndex: number) => void;
  selectDigit: (digit: Digit | null) => void;
  setPencilMode: (isPencilMode: boolean) => void;
  enterDigit: (cellIndex: number, digit: Digit) => void;
  togglePencilMark: (cellIndex: number, digit: Digit) => void;
  eraseCell: (cellIndex: number) => void;
  undo: () => void;
  requestHint: () => void;
  applyHint: () => void;
  clearGame: () => void;
  /** Scores the finished game, using the streak held at the time it ended. */
  summariseFinishedGame: (currentStreakDays: number) => FinishedGameSummary | null;
  remainingStrikes: number | null;
}

const GameContext = createContext<GameContextValue | null>(null);

export function GameProvider({ children }: { children: ReactNode }) {
  const [game, dispatch] = useReducer(gameReducer, null);
  const judgementInFlight = useRef(false);

  // The clock. Zen games are untimed for the player, but elapsed time is still
  // recorded so the history is complete.
  //
  // Depends on the status alone, not the whole game: depending on `game` would
  // tear down and restart the interval on every keystroke, so the displayed
  // second would reset each time the player typed.
  const isGameRunning = game !== null && game.status === 'playing';
  useEffect(() => {
    if (!isGameRunning) {
      return;
    }
    const interval = setInterval(() => dispatch({ type: 'tick' }), 1000);
    return () => clearInterval(interval);
  }, [isGameRunning]);

  // Checkpoint every change, so a crash costs at most the current move.
  useEffect(() => {
    if (game === null) {
      return;
    }
    if (game.status !== 'playing') {
      void clearGameSnapshot();
      return;
    }
    void saveGameSnapshot(toSnapshot(game)).catch((error) => {
      console.warn('Could not checkpoint the game', error);
    });
  }, [game]);

  // Judge pending placements once the interaction that produced them is done.
  useEffect(() => {
    if (game === null || game.pendingJudgements.length === 0 || judgementInFlight.current) {
      return;
    }

    const judgement = game.pendingJudgements[0];
    judgementInFlight.current = true;

    const task = runWhenIdle(() => {
      const digitsBefore = new Uint8Array(CELL_COUNT);
      for (let cellIndex = 0; cellIndex < CELL_COUNT; cellIndex += 1) {
        digitsBefore[cellIndex] =
          game.givens[cellIndex] !== EMPTY_CELL
            ? game.givens[cellIndex]
            : judgement.entriesBefore[cellIndex];
      }

      const verdict = judgePlacement(
        boardFromDigits(digitsBefore),
        judgement.cellIndex,
        judgement.digit,
        game.difficulty,
      );

      judgementInFlight.current = false;
      dispatch({
        type: 'resolveJudgement',
        cellIndex: judgement.cellIndex,
        wasGuess: verdict === 'unjustified',
      });
    });

    return () => {
      judgementInFlight.current = false;
      task.cancel();
    };
  }, [game]);

  const requestHint = useCallback(() => {
    if (game === null || game.status !== 'playing') {
      return;
    }
    const hint = findNextHint(boardForGame(game), game.difficulty);
    dispatch({ type: 'showHint', hint });
  }, [game]);

  const summariseFinishedGame = useCallback(
    (currentStreakDays: number): FinishedGameSummary | null => {
      if (game === null || game.status === 'playing') {
        return null;
      }
      return {
        game,
        dayKey: dayKeyOf(new Date()),
        score: computeScore({
          difficulty: game.difficulty,
          mode: game.mode,
          completed: game.status === 'won',
          elapsedSeconds: game.elapsedSeconds,
          wrongEntryCount: game.wrongEntryCount,
          repeatedWrongEntryCount: game.repeatedWrongEntryCount,
          unjustifiedPlacementCount: game.unjustifiedPlacementCount,
          hintCount: game.hintCount,
          instantValidationEnabled: game.instantValidationEnabled,
          strikeLimitEnabled: game.strikeLimitEnabled,
          autoCandidatesUsed: game.autoCandidatesUsed,
          currentStreakDays,
        }),
      };
    },
    [game],
  );

  const value = useMemo<GameContextValue>(
    () => ({
      game,
      startGame: (input) => dispatch({ type: 'startGame', input }),
      resumeGame: (resumed) => dispatch({ type: 'resumeGame', game: resumed }),
      selectCell: (cellIndex) => dispatch({ type: 'selectCell', cellIndex }),
      selectDigit: (digit) => dispatch({ type: 'selectDigit', digit }),
      setPencilMode: (isPencilMode) => dispatch({ type: 'setPencilMode', isPencilMode }),
      enterDigit: (cellIndex, digit) => dispatch({ type: 'enterDigit', cellIndex, digit }),
      togglePencilMark: (cellIndex, digit) =>
        dispatch({ type: 'togglePencilMark', cellIndex, digit }),
      eraseCell: (cellIndex) => dispatch({ type: 'eraseCell', cellIndex }),
      undo: () => dispatch({ type: 'undo' }),
      requestHint,
      applyHint: () => dispatch({ type: 'applyHint' }),
      clearGame: () => dispatch({ type: 'clearGame' }),
      summariseFinishedGame,
      remainingStrikes:
        game === null || !game.strikeLimitEnabled
          ? null
          : Math.max(0, MAX_STRIKES - game.strikeCount),
    }),
    [game, requestHint, summariseFinishedGame],
  );

  return <GameContext.Provider value={value}>{children}</GameContext.Provider>;
}

export function useGame(): GameContextValue {
  const value = useContext(GameContext);
  if (value === null) {
    throw new Error('useGame must be used inside a GameProvider');
  }
  return value;
}

/** Candidate count for a cell, used by the board to size pencil marks. */
export function pencilMarkCount(game: ActiveGame, cellIndex: number): number {
  return countCandidates(game.pencilMarks[cellIndex]);
}
