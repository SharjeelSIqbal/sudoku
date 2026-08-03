/**
 * Engine vocabulary. Everything in `src/game` speaks these types and nothing
 * outside `src/game` defines them.
 */

/** Width and height of the grid, and the count of digits. */
export const BOARD_SIZE = 9;

/** Width and height of one box. */
export const BOX_SIZE = 3;

/** Total cells on the board. */
export const CELL_COUNT = BOARD_SIZE * BOARD_SIZE;

/** The value stored in a cell that has no digit yet. */
export const EMPTY_CELL = 0;

/** A placed value. Never 0 — an empty cell is `EMPTY_CELL`, not a Digit. */
export type Digit = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9;

export const ALL_DIGITS: readonly Digit[] = [1, 2, 3, 4, 5, 6, 7, 8, 9];

/**
 * A board, held as flat typed arrays rather than nested arrays of cell
 * objects. The technique ladder runs after every move and again many times
 * per generated puzzle, so per-cell allocation is the dominant cost — this
 * shape keeps a board at two small buffers that clone in one call each.
 */
export interface Board {
  /** 81 entries, `EMPTY_CELL` or a Digit. */
  digits: Uint8Array;
  /**
   * 81 entries of 9-bit candidate masks; bit `digit - 1` set means the digit
   * is still possible in that cell. Meaningless for filled cells, where it is
   * held at 0.
   */
  candidates: Uint16Array;
}

/** The three kinds of unit a deduction can be made within. */
export type UnitKind = 'row' | 'column' | 'box';

export interface Unit {
  kind: UnitKind;
  /** 0-8 within its kind. */
  indexWithinKind: number;
  /** The nine cell indexes making up this unit. */
  cellIndexes: readonly number[];
}

/**
 * How a game is being played. Ranked feeds points, streaks and awards; zen is
 * untimed and unscored, for when the point is the puzzle and not the score.
 */
export type PlayMode = 'ranked' | 'zen';

/** The six difficulty tiers, easiest first. */
export type Difficulty =
  | 'easy'
  | 'medium'
  | 'hard'
  | 'expert'
  | 'extreme'
  | 'master';

export const DIFFICULTIES: readonly Difficulty[] = [
  'easy',
  'medium',
  'hard',
  'expert',
  'extreme',
  'master',
];

/**
 * Every human technique the engine can apply. The order here is not the
 * ladder — `techniques/registry.ts` owns cost and tier.
 */
export type TechniqueId =
  | 'fullHouse'
  | 'nakedSingle'
  | 'hiddenSingleBox'
  | 'hiddenSingleLine'
  | 'pointingCandidates'
  | 'claimingCandidates'
  | 'nakedPair'
  | 'hiddenPair'
  | 'nakedTriple'
  | 'hiddenTriple'
  | 'nakedQuad'
  | 'hiddenQuad'
  | 'xWing'
  | 'simpleColouring'
  | 'xyWing'
  | 'swordfish'
  | 'xyzWing'
  | 'wWing'
  | 'jellyfish'
  | 'uniqueRectangle'
  | 'forcingChain';

/** A digit the technique proved belongs in a cell. */
export interface Placement {
  cellIndex: number;
  digit: Digit;
}

/** A candidate the technique proved cannot be in a cell. */
export interface Elimination {
  cellIndex: number;
  digit: Digit;
}

/**
 * What a technique found. A technique returns `null` when it does not fire;
 * when it does fire it must report at least one placement or elimination.
 */
export interface TechniqueResult {
  technique: TechniqueId;
  placements: Placement[];
  eliminations: Elimination[];
  /**
   * The cells that justify the deduction. Used to highlight a hint, so the
   * player sees *why* rather than just being handed the answer.
   */
  reasonCellIndexes: number[];
  /** One sentence naming the technique and its subject, shown with a hint. */
  explanation: string;
}

/** A technique is a pure function of the board. */
export type Technique = (board: Board) => TechniqueResult | null;

/** One applied step of a logical solve. */
export interface SolveStep {
  technique: TechniqueId;
  placements: Placement[];
  eliminations: Elimination[];
  explanation: string;
}

export interface LogicalSolveOutcome {
  /** True when the ladder filled every cell without guessing. */
  solved: boolean;
  /** The steps applied, in order. */
  steps: SolveStep[];
  /** How many times each technique fired. */
  techniqueCounts: Partial<Record<TechniqueId, number>>;
  /**
   * The hardest tier any applied step required, or null when no step fired.
   */
  hardestTierUsed: Difficulty | null;
}
