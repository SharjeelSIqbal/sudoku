/**
 * Board representation and the precomputed geometry every technique needs.
 *
 * The lookup tables below are built once at module load. Techniques iterate
 * units and peers constantly, and recomputing "which cells share a box with
 * cell 47" inside those loops is the difference between a hint feeling
 * instant and the board dropping frames.
 */

import {
  ALL_DIGITS,
  BOARD_SIZE,
  BOX_SIZE,
  CELL_COUNT,
  EMPTY_CELL,
  type Board,
  type Digit,
  type Unit,
} from './types';

/** Every candidate still open: bits 0-8 set. */
export const ALL_CANDIDATES_MASK = (1 << BOARD_SIZE) - 1;

/** The candidate-mask bit for a digit. */
export function maskOfDigit(digit: Digit): number {
  return 1 << (digit - 1);
}

/** The digits present in a candidate mask, ascending. */
export function digitsInMask(mask: number): Digit[] {
  const digits: Digit[] = [];
  for (const digit of ALL_DIGITS) {
    if ((mask & maskOfDigit(digit)) !== 0) {
      digits.push(digit);
    }
  }
  return digits;
}

/** How many candidates a mask holds. */
export function countCandidates(mask: number): number {
  let remaining = mask;
  let count = 0;
  while (remaining !== 0) {
    remaining &= remaining - 1;
    count += 1;
  }
  return count;
}

/** The single digit in a one-bit mask. Throws if the mask is not a single. */
export function soleDigitInMask(mask: number): Digit {
  const digits = digitsInMask(mask);
  if (digits.length !== 1) {
    throw new Error(`Expected exactly one candidate, mask held ${digits.length}`);
  }
  return digits[0];
}

export const ROW_OF_CELL = new Uint8Array(CELL_COUNT);
export const COLUMN_OF_CELL = new Uint8Array(CELL_COUNT);
export const BOX_OF_CELL = new Uint8Array(CELL_COUNT);

for (let cellIndex = 0; cellIndex < CELL_COUNT; cellIndex += 1) {
  const rowIndex = Math.floor(cellIndex / BOARD_SIZE);
  const columnIndex = cellIndex % BOARD_SIZE;
  ROW_OF_CELL[cellIndex] = rowIndex;
  COLUMN_OF_CELL[cellIndex] = columnIndex;
  BOX_OF_CELL[cellIndex] =
    Math.floor(rowIndex / BOX_SIZE) * BOX_SIZE + Math.floor(columnIndex / BOX_SIZE);
}

/** Cell index from row and column, both 0-8. */
export function cellIndexAt(rowIndex: number, columnIndex: number): number {
  return rowIndex * BOARD_SIZE + columnIndex;
}

function buildUnitCells(): {
  rows: number[][];
  columns: number[][];
  boxes: number[][];
} {
  const rows: number[][] = Array.from({ length: BOARD_SIZE }, () => []);
  const columns: number[][] = Array.from({ length: BOARD_SIZE }, () => []);
  const boxes: number[][] = Array.from({ length: BOARD_SIZE }, () => []);

  for (let cellIndex = 0; cellIndex < CELL_COUNT; cellIndex += 1) {
    rows[ROW_OF_CELL[cellIndex]].push(cellIndex);
    columns[COLUMN_OF_CELL[cellIndex]].push(cellIndex);
    boxes[BOX_OF_CELL[cellIndex]].push(cellIndex);
  }

  return { rows, columns, boxes };
}

const unitCells = buildUnitCells();

export const CELLS_IN_ROW: readonly (readonly number[])[] = unitCells.rows;
export const CELLS_IN_COLUMN: readonly (readonly number[])[] = unitCells.columns;
export const CELLS_IN_BOX: readonly (readonly number[])[] = unitCells.boxes;

/** All 27 units: nine rows, then nine columns, then nine boxes. */
export const ALL_UNITS: readonly Unit[] = [
  ...unitCells.rows.map((cellIndexes, indexWithinKind) => ({
    kind: 'row' as const,
    indexWithinKind,
    cellIndexes,
  })),
  ...unitCells.columns.map((cellIndexes, indexWithinKind) => ({
    kind: 'column' as const,
    indexWithinKind,
    cellIndexes,
  })),
  ...unitCells.boxes.map((cellIndexes, indexWithinKind) => ({
    kind: 'box' as const,
    indexWithinKind,
    cellIndexes,
  })),
];

/** The 20 cells that share a row, column or box with each cell. */
export const PEERS_OF_CELL: readonly (readonly number[])[] = (() => {
  const peers: number[][] = [];
  for (let cellIndex = 0; cellIndex < CELL_COUNT; cellIndex += 1) {
    const peerSet = new Set<number>([
      ...unitCells.rows[ROW_OF_CELL[cellIndex]],
      ...unitCells.columns[COLUMN_OF_CELL[cellIndex]],
      ...unitCells.boxes[BOX_OF_CELL[cellIndex]],
    ]);
    peerSet.delete(cellIndex);
    peers.push([...peerSet].sort((left, right) => left - right));
  }
  return peers;
})();

/** True when the two cells share any unit. */
export function cellsArePeers(firstCell: number, secondCell: number): boolean {
  return (
    firstCell !== secondCell &&
    (ROW_OF_CELL[firstCell] === ROW_OF_CELL[secondCell] ||
      COLUMN_OF_CELL[firstCell] === COLUMN_OF_CELL[secondCell] ||
      BOX_OF_CELL[firstCell] === BOX_OF_CELL[secondCell])
  );
}

export function createEmptyBoard(): Board {
  return {
    digits: new Uint8Array(CELL_COUNT),
    candidates: new Uint16Array(CELL_COUNT).fill(ALL_CANDIDATES_MASK),
  };
}

export function cloneBoard(board: Board): Board {
  return {
    digits: new Uint8Array(board.digits),
    candidates: new Uint16Array(board.candidates),
  };
}

/**
 * Rebuilds every candidate mask from the placed digits. Filled cells hold a
 * mask of 0 so that "cell has candidates" and "cell is empty" cannot drift
 * apart.
 */
export function recomputeCandidates(board: Board): void {
  for (let cellIndex = 0; cellIndex < CELL_COUNT; cellIndex += 1) {
    if (board.digits[cellIndex] !== EMPTY_CELL) {
      board.candidates[cellIndex] = 0;
      continue;
    }

    let mask = ALL_CANDIDATES_MASK;
    for (const peerCell of PEERS_OF_CELL[cellIndex]) {
      const peerDigit = board.digits[peerCell];
      if (peerDigit !== EMPTY_CELL) {
        mask &= ~maskOfDigit(peerDigit as Digit);
      }
    }
    board.candidates[cellIndex] = mask;
  }
}

/** Builds a board from 81 digit values and derives its candidates. */
export function boardFromDigits(digits: ArrayLike<number>): Board {
  if (digits.length !== CELL_COUNT) {
    throw new Error(`A board needs ${CELL_COUNT} cells, received ${digits.length}`);
  }
  const board: Board = {
    digits: Uint8Array.from(digits),
    candidates: new Uint16Array(CELL_COUNT),
  };
  recomputeCandidates(board);
  return board;
}

/**
 * Parses the standard 81-character form, where `.` or `0` is an empty cell.
 * Whitespace is ignored so fixtures can be laid out as a readable 9x9 block.
 */
export function boardFromString(text: string): Board {
  const compact = text.replace(/\s/g, '');
  if (compact.length !== CELL_COUNT) {
    throw new Error(
      `A board string needs ${CELL_COUNT} non-space characters, received ${compact.length}`,
    );
  }
  const digits = new Uint8Array(CELL_COUNT);
  for (let cellIndex = 0; cellIndex < CELL_COUNT; cellIndex += 1) {
    const character = compact[cellIndex];
    digits[cellIndex] = character === '.' || character === '0' ? EMPTY_CELL : Number(character);
  }
  return boardFromDigits(digits);
}

/** The 81-character form, using `.` for empty cells. */
export function boardToString(board: Board): string {
  let text = '';
  for (let cellIndex = 0; cellIndex < CELL_COUNT; cellIndex += 1) {
    const digit = board.digits[cellIndex];
    text += digit === EMPTY_CELL ? '.' : `${digit}`;
  }
  return text;
}

/**
 * Places a digit and removes it from the candidates of every peer. Callers
 * that place many digits at once may prefer `recomputeCandidates`, but this
 * keeps the board consistent after a single move without a full rebuild.
 */
export function placeDigit(board: Board, cellIndex: number, digit: Digit): void {
  board.digits[cellIndex] = digit;
  board.candidates[cellIndex] = 0;
  const removalMask = ~maskOfDigit(digit);
  for (const peerCell of PEERS_OF_CELL[cellIndex]) {
    board.candidates[peerCell] &= removalMask;
  }
}

/** Removes a candidate. Returns true when the candidate was actually there. */
export function eliminateCandidate(
  board: Board,
  cellIndex: number,
  digit: Digit,
): boolean {
  const mask = maskOfDigit(digit);
  if ((board.candidates[cellIndex] & mask) === 0) {
    return false;
  }
  board.candidates[cellIndex] &= ~mask;
  return true;
}

export function countEmptyCells(board: Board): number {
  let count = 0;
  for (let cellIndex = 0; cellIndex < CELL_COUNT; cellIndex += 1) {
    if (board.digits[cellIndex] === EMPTY_CELL) {
      count += 1;
    }
  }
  return count;
}

export function isBoardFilled(board: Board): boolean {
  return countEmptyCells(board) === 0;
}

/**
 * True when no unit repeats a digit. A filled, consistent board is solved;
 * a partially filled consistent board is merely not yet wrong.
 */
export function isBoardConsistent(board: Board): boolean {
  for (const unit of ALL_UNITS) {
    let seenMask = 0;
    for (const cellIndex of unit.cellIndexes) {
      const digit = board.digits[cellIndex];
      if (digit === EMPTY_CELL) {
        continue;
      }
      const digitMask = maskOfDigit(digit as Digit);
      if ((seenMask & digitMask) !== 0) {
        return false;
      }
      seenMask |= digitMask;
    }
  }
  return true;
}

export function isBoardSolved(board: Board): boolean {
  return isBoardFilled(board) && isBoardConsistent(board);
}

/**
 * True when the board cannot possibly be completed, in either of the two ways
 * that shows up: an empty cell with no candidates left, or a unit with no home
 * for a digit it has not placed. Both matter — the forcing-chain technique
 * proves a hypothesis wrong by reaching one of them, and it would miss half
 * its deductions if only the first were checked.
 */
export function hasContradiction(board: Board): boolean {
  for (let cellIndex = 0; cellIndex < CELL_COUNT; cellIndex += 1) {
    if (board.digits[cellIndex] === EMPTY_CELL && board.candidates[cellIndex] === 0) {
      return true;
    }
  }

  for (const unit of ALL_UNITS) {
    let placedMask = 0;
    let availableMask = 0;
    for (const cellIndex of unit.cellIndexes) {
      const digit = board.digits[cellIndex];
      if (digit === EMPTY_CELL) {
        availableMask |= board.candidates[cellIndex];
      } else {
        placedMask |= maskOfDigit(digit as Digit);
      }
    }
    if ((placedMask | availableMask) !== ALL_CANDIDATES_MASK) {
      return true;
    }
  }

  return false;
}

/** Human-facing cell name, e.g. cell 0 is `r1c1`. Used in hint explanations. */
export function describeCell(cellIndex: number): string {
  return `r${ROW_OF_CELL[cellIndex] + 1}c${COLUMN_OF_CELL[cellIndex] + 1}`;
}

/** Human-facing unit name, e.g. `row 3`, `box 7`. Used in hint explanations. */
export function describeUnit(unit: Unit): string {
  return `${unit.kind} ${unit.indexWithinKind + 1}`;
}
