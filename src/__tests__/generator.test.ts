import { boardFromDigits, boardToString } from '../game/board';
import {
  boardForPuzzle,
  generateDailyPuzzle,
  generatePuzzle,
  solutionForGivens,
} from '../game/generator';
import { gradePuzzle, solveLogically } from '../game/grading';
import { seedFromDate } from '../game/rng';
import { hasUniqueSolution } from '../game/solver';
import { CELL_COUNT, DIFFICULTIES, EMPTY_CELL, type Difficulty } from '../game/types';

/**
 * Property tests over generated puzzles. These are the tests that would catch
 * a shipped puzzle being unsolvable, ambiguous, or lying about its tier — the
 * three failures a player would actually notice.
 */
const SEEDS_PER_TIER = 3;

const CORPUS: { difficulty: Difficulty; seed: string }[] = DIFFICULTIES.flatMap(
  (difficulty) =>
    Array.from({ length: SEEDS_PER_TIER }, (_, seedIndex) => ({
      difficulty,
      seed: `property-${difficulty}-${seedIndex}`,
    })),
);

describe.each(CORPUS.map((entry) => [entry.difficulty, entry.seed, entry]))(
  'a generated %s puzzle (seed %s)',
  (_difficulty, _seed, entry) => {
    const puzzle = generatePuzzle(entry.seed, entry.difficulty);
    const board = boardForPuzzle(puzzle);

    it('has exactly one solution', () => {
      expect(hasUniqueSolution(board)).toBe(true);
    });

    it('is solvable by the technique ladder without guessing', () => {
      expect(solveLogically(board).solved).toBe(true);
    });

    it('grades at exactly the tier that was asked for', () => {
      expect(gradePuzzle(board)).toBe(entry.difficulty);
    });

    it('reports the difficulty it was asked for', () => {
      expect(puzzle.difficulty).toBe(entry.difficulty);
    });

    it('agrees with its own solution on every given', () => {
      for (let cellIndex = 0; cellIndex < CELL_COUNT; cellIndex += 1) {
        if (puzzle.givens[cellIndex] !== EMPTY_CELL) {
          expect(puzzle.givens[cellIndex]).toBe(puzzle.solution[cellIndex]);
        }
      }
    });

    it('carries a solution that is itself a valid complete grid', () => {
      expect(boardToString(boardFromDigits(puzzle.solution))).toHaveLength(81);
      expect(solutionForGivens(puzzle.givens)).toEqual(puzzle.solution);
    });

    it('leaves the player something to do', () => {
      expect(puzzle.clueCount).toBeGreaterThanOrEqual(17);
      expect(puzzle.clueCount).toBeLessThan(CELL_COUNT);
    });
  },
);

describe('seeded determinism', () => {
  it.each(DIFFICULTIES)('generates the identical %s puzzle twice from one seed', (difficulty) => {
    const first = generatePuzzle(`determinism-${difficulty}`, difficulty);
    const second = generatePuzzle(`determinism-${difficulty}`, difficulty);

    expect([...first.givens]).toEqual([...second.givens]);
    expect([...first.solution]).toEqual([...second.solution]);
    expect(first.seed).toBe(second.seed);
  });

  it('generates different puzzles from different seeds', () => {
    const first = generatePuzzle('distinct-seed-one', 'medium');
    const second = generatePuzzle('distinct-seed-two', 'medium');
    expect([...first.givens]).not.toEqual([...second.givens]);
  });
});

describe('the daily challenge', () => {
  it('hands the same date the same puzzle, with no server involved', () => {
    const date = new Date(Date.UTC(2026, 7, 3));
    const first = generateDailyPuzzle(date, 'medium');
    const second = generateDailyPuzzle(new Date(Date.UTC(2026, 7, 3)), 'medium');
    expect([...first.givens]).toEqual([...second.givens]);
  });

  it('hands different dates different puzzles', () => {
    const firstDay = generateDailyPuzzle(new Date(Date.UTC(2026, 7, 3)), 'medium');
    const secondDay = generateDailyPuzzle(new Date(Date.UTC(2026, 7, 4)), 'medium');
    expect([...firstDay.givens]).not.toEqual([...secondDay.givens]);
  });

  it('ignores the time of day, so the puzzle does not change at noon', () => {
    const morning = seedFromDate(new Date(Date.UTC(2026, 7, 3, 1, 30)));
    const evening = seedFromDate(new Date(Date.UTC(2026, 7, 3, 23, 45)));
    expect(morning).toBe(evening);
  });
});

describe('clue count is not difficulty', () => {
  it('does not order tiers by how many clues they leave', () => {
    // The naive "fewer clues means harder" heuristic is the classic way to get
    // sudoku difficulty wrong. This asserts the generator is not accidentally
    // implementing it: across the tiers, clue count is not monotonic.
    const clueCounts = DIFFICULTIES.map(
      (difficulty) => generatePuzzle(`clues-${difficulty}`, difficulty).clueCount,
    );

    const isStrictlyDescending = clueCounts.every(
      (count, index) => index === 0 || count < clueCounts[index - 1],
    );
    expect(isStrictlyDescending).toBe(false);
  });
});

describe('generator failure is loud', () => {
  it('throws rather than returning an off-target puzzle', () => {
    expect(() => generatePuzzle('impossible', 'master', { maximumAttempts: 0 })).toThrow(
      /Could not generate a master puzzle/,
    );
  });
});
