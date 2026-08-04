/**
 * Puzzle generation.
 *
 * The shape of the algorithm is: build a full solved grid, dig cells out while
 * the puzzle stays unique, then tune the result up or down until it grades at
 * the tier that was asked for.
 *
 * Everything here is a pure function of `(seed, difficulty)`. That is what
 * makes a bad puzzle reproducible from a bug report, and it is what lets the
 * daily challenge hand every install the same grid with no server involved.
 */

import { boardFromDigits, cloneBoard } from './board';
import { difficultyRank, solveLogically } from './grading';
import { createRandomNumberGenerator, seedFromDate, type RandomNumberGenerator } from './rng';
import { createSolvedGrid, findFirstSolution, hasUniqueSolution } from './solver';
import {
  CELL_COUNT,
  DIFFICULTIES,
  EMPTY_CELL,
  type Board,
  type Difficulty,
} from './types';

export interface GeneratedPuzzle {
  /** The 81 givens; `EMPTY_CELL` where the player has to work. */
  givens: Uint8Array;
  /** The unique completed grid. */
  solution: Uint8Array;
  difficulty: Difficulty;
  /** The exact seed that produced this puzzle, for reproducing it later. */
  seed: string;
  clueCount: number;
}

export interface GenerateOptions {
  /**
   * How many solved grids to try before giving up. Higher tiers need more
   * attempts because a random minimal puzzle usually lands mid-ladder, and
   * Master in particular is rare.
   */
  maximumAttempts?: number;
}

const DEFAULT_MAXIMUM_ATTEMPTS = 80;

type GradeVerdict = 'tooEasy' | 'match' | 'tooHard';

/**
 * Classifies a puzzle against a target tier without ever computing its exact
 * grade.
 *
 * The cheap check runs first on purpose: proving a puzzle is *too easy* only
 * needs the tiers below the target, so a Master attempt that turns out to be
 * an Extreme puzzle is rejected without paying for a single forcing chain.
 */
function classifyAgainstTarget(board: Board, target: Difficulty): GradeVerdict {
  const targetRank = difficultyRank(target);

  if (targetRank > 0) {
    const belowTarget = solveLogically(board, {
      maximumDifficulty: DIFFICULTIES[targetRank - 1],
    });
    if (belowTarget.solved) {
      return 'tooEasy';
    }
  }

  const atTarget = solveLogically(board, { maximumDifficulty: target });
  return atTarget.solved ? 'match' : 'tooHard';
}

/**
 * Removes cells one at a time for as long as the puzzle keeps exactly one
 * solution, producing a minimal puzzle for this ordering. Returns the cells
 * that were emptied, in the order they went.
 */
function digOutCells(
  givens: Uint8Array,
  random: RandomNumberGenerator,
): number[] {
  const cellOrder = random.shuffled(
    Array.from({ length: CELL_COUNT }, (_, cellIndex) => cellIndex),
  );
  const removedCells: number[] = [];

  for (const cellIndex of cellOrder) {
    const removedDigit = givens[cellIndex];
    if (removedDigit === EMPTY_CELL) {
      continue;
    }

    givens[cellIndex] = EMPTY_CELL;
    if (hasUniqueSolution(boardFromDigits(givens))) {
      removedCells.push(cellIndex);
    } else {
      givens[cellIndex] = removedDigit;
    }
  }

  return removedCells;
}

/**
 * Puts clues back until the puzzle drops to the target tier. Restoring a clue
 * can only make a puzzle easier, so this walks monotonically down the ladder;
 * a restore that overshoots into "too easy" is undone and another cell tried.
 */
function easeUntilTarget(
  givens: Uint8Array,
  solution: Uint8Array,
  removedCells: readonly number[],
  target: Difficulty,
  random: RandomNumberGenerator,
): boolean {
  for (const cellIndex of random.shuffled(removedCells)) {
    givens[cellIndex] = solution[cellIndex];

    const verdict = classifyAgainstTarget(boardFromDigits(givens), target);
    if (verdict === 'match') {
      return true;
    }
    if (verdict === 'tooEasy') {
      givens[cellIndex] = EMPTY_CELL;
    }
  }

  return false;
}

function countClues(givens: Uint8Array): number {
  let count = 0;
  for (let cellIndex = 0; cellIndex < CELL_COUNT; cellIndex += 1) {
    if (givens[cellIndex] !== EMPTY_CELL) {
      count += 1;
    }
  }
  return count;
}

/**
 * Generates a puzzle graded exactly at `difficulty`.
 *
 * Throws rather than returning something off-target: a puzzle that does not
 * grade where it claims is worse than a visible failure, because it silently
 * corrupts the points a player earns and the tier stats they see.
 */
export function generatePuzzle(
  seed: string,
  difficulty: Difficulty,
  options: GenerateOptions = {},
): GeneratedPuzzle {
  const maximumAttempts = options.maximumAttempts ?? DEFAULT_MAXIMUM_ATTEMPTS;

  for (let attemptIndex = 0; attemptIndex < maximumAttempts; attemptIndex += 1) {
    const attemptSeed = `${seed}#${attemptIndex}`;
    const random = createRandomNumberGenerator(attemptSeed);
    const solution = createSolvedGrid(random);
    const givens = new Uint8Array(solution);

    const removedCells = digOutCells(givens, random);
    const verdict = classifyAgainstTarget(boardFromDigits(givens), difficulty);

    if (verdict === 'match') {
      return {
        givens,
        solution,
        difficulty,
        seed: attemptSeed,
        clueCount: countClues(givens),
      };
    }

    // A minimal puzzle that is still too easy cannot be made harder by adding
    // clues, so this ordering is spent — take a fresh grid.
    if (verdict === 'tooEasy') {
      continue;
    }

    if (easeUntilTarget(givens, solution, removedCells, difficulty, random)) {
      return {
        givens,
        solution,
        difficulty,
        seed: attemptSeed,
        clueCount: countClues(givens),
      };
    }
  }

  throw new Error(
    `Could not generate a ${difficulty} puzzle from seed "${seed}" in ${maximumAttempts} attempts`,
  );
}

/** The daily challenge for a date — identical on every install, no server. */
export function generateDailyPuzzle(
  date: Date,
  difficulty: Difficulty,
  options: GenerateOptions = {},
): GeneratedPuzzle {
  return generatePuzzle(seedFromDate(date), difficulty, options);
}

/**
 * The completed grid for a set of givens. Used when restoring a saved game,
 * where the solution was not persisted alongside the board.
 */
export function solutionForGivens(givens: ArrayLike<number>): Uint8Array {
  const solution = findFirstSolution(boardFromDigits(givens));
  if (solution === null) {
    throw new Error('These givens have no solution');
  }
  return solution;
}

/** A playable board built from a puzzle's givens. */
export function boardForPuzzle(puzzle: GeneratedPuzzle): Board {
  return cloneBoard(boardFromDigits(puzzle.givens));
}
