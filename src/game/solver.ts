/**
 * Brute-force solver.
 *
 * Used for two things only: proving a puzzle has exactly one solution, and
 * producing the solution grid the game checks entries against. It is
 * deliberately *not* used to grade puzzles or to justify a player's move —
 * both of those are questions about human reasoning, and a backtracking
 * search answers a different question. `grading.ts` owns that.
 */

import {
  ALL_CANDIDATES_MASK,
  BOX_OF_CELL,
  COLUMN_OF_CELL,
  ROW_OF_CELL,
  countCandidates,
  maskOfDigit,
} from './board';
import { type RandomNumberGenerator } from './rng';
import {
  ALL_DIGITS,
  BOARD_SIZE,
  CELL_COUNT,
  EMPTY_CELL,
  type Board,
  type Digit,
} from './types';

interface SearchState {
  digits: Uint8Array;
  digitsUsedInRow: Uint16Array;
  digitsUsedInColumn: Uint16Array;
  digitsUsedInBox: Uint16Array;
  solutionsFound: number;
  solutionLimit: number;
  firstSolution: Uint8Array | null;
  /** When set, digits are tried in this order — used to build random grids. */
  digitOrder: readonly Digit[];
  /** True when the givens already repeat a digit within a unit. */
  givensAreInconsistent: boolean;
}

function createSearchState(
  digits: Uint8Array,
  solutionLimit: number,
  digitOrder: readonly Digit[],
): SearchState {
  const state: SearchState = {
    digits: new Uint8Array(digits),
    digitsUsedInRow: new Uint16Array(BOARD_SIZE),
    digitsUsedInColumn: new Uint16Array(BOARD_SIZE),
    digitsUsedInBox: new Uint16Array(BOARD_SIZE),
    solutionsFound: 0,
    solutionLimit,
    firstSolution: null,
    digitOrder,
    givensAreInconsistent: false,
  };

  for (let cellIndex = 0; cellIndex < CELL_COUNT; cellIndex += 1) {
    const digit = state.digits[cellIndex];
    if (digit === EMPTY_CELL) {
      continue;
    }
    const mask = maskOfDigit(digit as Digit);
    const rowIndex = ROW_OF_CELL[cellIndex];
    const columnIndex = COLUMN_OF_CELL[cellIndex];
    const boxIndex = BOX_OF_CELL[cellIndex];

    // A repeated given makes the board unsolvable, but the search cannot see
    // that: the duplicate sets a mask bit that is already set, so it looks
    // exactly like a single placement. Without this check the solver goes off
    // and tries to prove unsolvability by exhaustion, which on a mostly empty
    // grid does not finish in any useful time.
    if (
      (state.digitsUsedInRow[rowIndex] & mask) !== 0 ||
      (state.digitsUsedInColumn[columnIndex] & mask) !== 0 ||
      (state.digitsUsedInBox[boxIndex] & mask) !== 0
    ) {
      state.givensAreInconsistent = true;
      return state;
    }

    state.digitsUsedInRow[rowIndex] |= mask;
    state.digitsUsedInColumn[columnIndex] |= mask;
    state.digitsUsedInBox[boxIndex] |= mask;
  }

  return state;
}

function availableMaskForCell(state: SearchState, cellIndex: number): number {
  const used =
    state.digitsUsedInRow[ROW_OF_CELL[cellIndex]] |
    state.digitsUsedInColumn[COLUMN_OF_CELL[cellIndex]] |
    state.digitsUsedInBox[BOX_OF_CELL[cellIndex]];
  return ALL_CANDIDATES_MASK & ~used;
}

/**
 * Picks the empty cell with the fewest options (minimum remaining values).
 * Returns -1 when the grid is full, or -2 when some empty cell has no options
 * and the branch is dead.
 */
function selectMostConstrainedCell(state: SearchState): number {
  let bestCellIndex = -1;
  let bestOptionCount = BOARD_SIZE + 1;

  for (let cellIndex = 0; cellIndex < CELL_COUNT; cellIndex += 1) {
    if (state.digits[cellIndex] !== EMPTY_CELL) {
      continue;
    }
    const optionCount = countCandidates(availableMaskForCell(state, cellIndex));
    if (optionCount === 0) {
      return -2;
    }
    if (optionCount < bestOptionCount) {
      bestOptionCount = optionCount;
      bestCellIndex = cellIndex;
      if (optionCount === 1) {
        break;
      }
    }
  }

  return bestCellIndex;
}

/** Returns true when the caller should stop searching (limit reached). */
function search(state: SearchState): boolean {
  const cellIndex = selectMostConstrainedCell(state);

  if (cellIndex === -2) {
    return false;
  }

  if (cellIndex === -1) {
    state.solutionsFound += 1;
    if (state.firstSolution === null) {
      state.firstSolution = new Uint8Array(state.digits);
    }
    return state.solutionsFound >= state.solutionLimit;
  }

  const availableMask = availableMaskForCell(state, cellIndex);
  const rowIndex = ROW_OF_CELL[cellIndex];
  const columnIndex = COLUMN_OF_CELL[cellIndex];
  const boxIndex = BOX_OF_CELL[cellIndex];

  for (const digit of state.digitOrder) {
    const mask = maskOfDigit(digit);
    if ((availableMask & mask) === 0) {
      continue;
    }

    state.digits[cellIndex] = digit;
    state.digitsUsedInRow[rowIndex] |= mask;
    state.digitsUsedInColumn[columnIndex] |= mask;
    state.digitsUsedInBox[boxIndex] |= mask;

    const shouldStop = search(state);

    state.digits[cellIndex] = EMPTY_CELL;
    state.digitsUsedInRow[rowIndex] &= ~mask;
    state.digitsUsedInColumn[columnIndex] &= ~mask;
    state.digitsUsedInBox[boxIndex] &= ~mask;

    if (shouldStop) {
      return true;
    }
  }

  return false;
}

/**
 * Counts solutions, stopping as soon as `solutionLimit` is reached. Uniqueness
 * checks pass 2: the answer to "is this unique" is "stop at the second", never
 * "enumerate them all".
 */
export function countSolutions(board: Board, solutionLimit = 2): number {
  const state = createSearchState(board.digits, solutionLimit, ALL_DIGITS);
  if (state.givensAreInconsistent) {
    return 0;
  }
  search(state);
  return state.solutionsFound;
}

export function hasUniqueSolution(board: Board): boolean {
  return countSolutions(board, 2) === 1;
}

/** The solution grid, or null when the board cannot be completed. */
export function findFirstSolution(board: Board): Uint8Array | null {
  const state = createSearchState(board.digits, 1, ALL_DIGITS);
  if (state.givensAreInconsistent) {
    return null;
  }
  search(state);
  return state.firstSolution;
}

/**
 * Builds a complete, valid grid. Randomising the digit order is what makes
 * successive seeds produce different puzzles rather than the same lexicographic
 * grid every time.
 */
export function createSolvedGrid(random: RandomNumberGenerator): Uint8Array {
  const state = createSearchState(
    new Uint8Array(CELL_COUNT),
    1,
    random.shuffled(ALL_DIGITS),
  );
  search(state);
  if (state.firstSolution === null) {
    throw new Error('Failed to build a solved grid from an empty board');
  }
  return state.firstSolution;
}
