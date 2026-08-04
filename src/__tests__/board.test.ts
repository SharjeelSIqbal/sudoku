import {
  ALL_CANDIDATES_MASK,
  ALL_UNITS,
  BOX_OF_CELL,
  COLUMN_OF_CELL,
  PEERS_OF_CELL,
  ROW_OF_CELL,
  boardFromString,
  boardToString,
  cellIndexAt,
  cellsArePeers,
  countCandidates,
  describeCell,
  digitsInMask,
  hasContradiction,
  isBoardSolved,
  maskOfDigit,
  placeDigit,
  recomputeCandidates,
} from '../game/board';
import { CELL_COUNT, EMPTY_CELL } from '../game/types';

const SOLVED_GRID =
  '534678912672195348198342567859761423426853791713924856961537284287419635345286179';

describe('board geometry', () => {
  it('gives every cell exactly twenty peers', () => {
    for (let cellIndex = 0; cellIndex < CELL_COUNT; cellIndex += 1) {
      expect(PEERS_OF_CELL[cellIndex]).toHaveLength(20);
    }
  });

  it('never lists a cell as its own peer', () => {
    for (let cellIndex = 0; cellIndex < CELL_COUNT; cellIndex += 1) {
      expect(PEERS_OF_CELL[cellIndex]).not.toContain(cellIndex);
    }
  });

  it('makes peership symmetric', () => {
    for (let cellIndex = 0; cellIndex < CELL_COUNT; cellIndex += 1) {
      for (const peerCell of PEERS_OF_CELL[cellIndex]) {
        expect(PEERS_OF_CELL[peerCell]).toContain(cellIndex);
        expect(cellsArePeers(cellIndex, peerCell)).toBe(true);
      }
    }
  });

  it('builds 27 units of nine cells each', () => {
    expect(ALL_UNITS).toHaveLength(27);
    for (const unit of ALL_UNITS) {
      expect(unit.cellIndexes).toHaveLength(9);
      expect(new Set(unit.cellIndexes).size).toBe(9);
    }
  });

  it('places each cell in exactly three units', () => {
    for (let cellIndex = 0; cellIndex < CELL_COUNT; cellIndex += 1) {
      const containingUnits = ALL_UNITS.filter((unit) =>
        unit.cellIndexes.includes(cellIndex),
      );
      expect(containingUnits).toHaveLength(3);
    }
  });

  it('agrees between cellIndexAt and the row/column lookups', () => {
    for (let rowIndex = 0; rowIndex < 9; rowIndex += 1) {
      for (let columnIndex = 0; columnIndex < 9; columnIndex += 1) {
        const cellIndex = cellIndexAt(rowIndex, columnIndex);
        expect(ROW_OF_CELL[cellIndex]).toBe(rowIndex);
        expect(COLUMN_OF_CELL[cellIndex]).toBe(columnIndex);
      }
    }
  });

  it('puts the top-left nine cells in box 0 and the bottom-right in box 8', () => {
    expect(BOX_OF_CELL[cellIndexAt(0, 0)]).toBe(0);
    expect(BOX_OF_CELL[cellIndexAt(2, 2)]).toBe(0);
    expect(BOX_OF_CELL[cellIndexAt(8, 8)]).toBe(8);
    expect(BOX_OF_CELL[cellIndexAt(4, 4)]).toBe(4);
  });

  it('names cells in the r1c1 form humans use', () => {
    expect(describeCell(0)).toBe('r1c1');
    expect(describeCell(80)).toBe('r9c9');
  });
});

describe('candidate masks', () => {
  it('round-trips digits through a mask', () => {
    const mask = maskOfDigit(1) | maskOfDigit(5) | maskOfDigit(9);
    expect(digitsInMask(mask)).toEqual([1, 5, 9]);
    expect(countCandidates(mask)).toBe(3);
  });

  it('counts a full mask as nine candidates', () => {
    expect(countCandidates(ALL_CANDIDATES_MASK)).toBe(9);
    expect(digitsInMask(ALL_CANDIDATES_MASK)).toHaveLength(9);
  });
});

describe('board parsing', () => {
  it('round-trips through the 81-character form', () => {
    const board = boardFromString(SOLVED_GRID);
    expect(boardToString(board)).toBe(SOLVED_GRID);
  });

  it('accepts whitespace so fixtures can be laid out as a grid', () => {
    const laidOut = SOLVED_GRID.match(/.{9}/g)!.join('\n');
    expect(boardToString(boardFromString(laidOut))).toBe(SOLVED_GRID);
  });

  it('treats both . and 0 as empty', () => {
    const withDots = `.${SOLVED_GRID.slice(1)}`;
    const withZeroes = `0${SOLVED_GRID.slice(1)}`;
    expect(boardToString(boardFromString(withDots))).toBe(
      boardToString(boardFromString(withZeroes)),
    );
  });

  it('rejects a board that is not 81 cells', () => {
    expect(() => boardFromString('123')).toThrow(/81/);
  });
});

describe('board state', () => {
  it('recognises a solved grid', () => {
    expect(isBoardSolved(boardFromString(SOLVED_GRID))).toBe(true);
  });

  it('rejects a filled grid that repeats a digit in a unit', () => {
    const broken = `1${SOLVED_GRID.slice(1)}`;
    expect(isBoardSolved(boardFromString(broken))).toBe(false);
  });

  it('holds no candidates in filled cells', () => {
    const board = boardFromString(SOLVED_GRID);
    for (let cellIndex = 0; cellIndex < CELL_COUNT; cellIndex += 1) {
      expect(board.candidates[cellIndex]).toBe(0);
    }
  });

  it('strips a placed digit from every peer', () => {
    const board = boardFromString('.'.repeat(81));
    placeDigit(board, 0, 7);

    for (const peerCell of PEERS_OF_CELL[0]) {
      expect(board.candidates[peerCell] & maskOfDigit(7)).toBe(0);
    }
    const nonPeer = 80;
    expect(board.candidates[nonPeer] & maskOfDigit(7)).not.toBe(0);
  });

  it('keeps placeDigit and recomputeCandidates in agreement', () => {
    const board = boardFromString('.'.repeat(81));
    placeDigit(board, 0, 7);
    placeDigit(board, 40, 3);

    const expected = { ...board, candidates: new Uint16Array(board.candidates) };
    recomputeCandidates(board);
    expect([...board.candidates]).toEqual([...expected.candidates]);
  });

  it('spots a cell left with no candidates', () => {
    const board = boardFromString('.'.repeat(81));
    board.digits[0] = EMPTY_CELL;
    board.candidates[0] = 0;
    expect(hasContradiction(board)).toBe(true);
  });

  it('spots a unit with no home for a digit', () => {
    const board = boardFromString('.'.repeat(81));
    // Strip 5 from every cell of row 0 without placing it anywhere there.
    for (let columnIndex = 0; columnIndex < 9; columnIndex += 1) {
      board.candidates[cellIndexAt(0, columnIndex)] &= ~maskOfDigit(5);
    }
    expect(hasContradiction(board)).toBe(true);
  });

  it('does not call a healthy board contradictory', () => {
    expect(hasContradiction(boardFromString('.'.repeat(81)))).toBe(false);
    expect(hasContradiction(boardFromString(SOLVED_GRID))).toBe(false);
  });
});
