import {
  boardFromDigits,
  boardFromString,
  boardToString,
  isBoardSolved,
} from '../game/board';
import { createRandomNumberGenerator } from '../game/rng';
import {
  countSolutions,
  createSolvedGrid,
  findFirstSolution,
  hasUniqueSolution,
} from '../game/solver';

const UNIQUE_PUZZLE =
  '53..7....6..195....98....6.8...6...34..8.3..17...2...6.6....28....419..5....8..79';

const EMPTY_GRID = '.'.repeat(81);

describe('brute-force solver', () => {
  it('solves a classic puzzle to a consistent grid', () => {
    const solution = findFirstSolution(boardFromString(UNIQUE_PUZZLE));
    expect(solution).not.toBeNull();
    expect(isBoardSolved(boardFromDigits(solution!))).toBe(true);
  });

  it('keeps every given digit in the solution', () => {
    const puzzle = boardFromString(UNIQUE_PUZZLE);
    const solution = findFirstSolution(puzzle)!;
    for (let cellIndex = 0; cellIndex < 81; cellIndex += 1) {
      if (puzzle.digits[cellIndex] !== 0) {
        expect(solution[cellIndex]).toBe(puzzle.digits[cellIndex]);
      }
    }
  });

  it('reports a well-formed puzzle as unique', () => {
    expect(hasUniqueSolution(boardFromString(UNIQUE_PUZZLE))).toBe(true);
  });

  it('stops counting at the limit rather than enumerating everything', () => {
    // An empty grid has billions of solutions; the count must stop at 2.
    expect(countSolutions(boardFromString(EMPTY_GRID), 2)).toBe(2);
    expect(hasUniqueSolution(boardFromString(EMPTY_GRID))).toBe(false);
  });

  it('returns no solution for an inconsistent board', () => {
    const broken = `11${'.'.repeat(79)}`;
    expect(findFirstSolution(boardFromString(broken))).toBeNull();
    expect(countSolutions(boardFromString(broken))).toBe(0);
  });

  it('finds multiple solutions once a puzzle is under-clued', () => {
    // Removing a clue from a minimal puzzle must break uniqueness.
    const puzzle = boardFromString(UNIQUE_PUZZLE);
    const firstGivenIndex = puzzle.digits.findIndex((digit) => digit !== 0);
    puzzle.digits[firstGivenIndex] = 0;
    const loosened = boardFromDigits(puzzle.digits);
    expect(countSolutions(loosened, 2)).toBeGreaterThanOrEqual(1);
  });
});

describe('solved grid construction', () => {
  it('builds a valid complete grid', () => {
    const grid = createSolvedGrid(createRandomNumberGenerator('grid-seed'));
    expect(isBoardSolved(boardFromDigits(grid))).toBe(true);
  });

  it('is deterministic for a seed', () => {
    const first = createSolvedGrid(createRandomNumberGenerator('same-seed'));
    const second = createSolvedGrid(createRandomNumberGenerator('same-seed'));
    expect([...first]).toEqual([...second]);
  });

  it('produces different grids for different seeds', () => {
    const first = createSolvedGrid(createRandomNumberGenerator('seed-one'));
    const second = createSolvedGrid(createRandomNumberGenerator('seed-two'));
    expect(boardToString(boardFromDigits(first))).not.toBe(
      boardToString(boardFromDigits(second)),
    );
  });
});
