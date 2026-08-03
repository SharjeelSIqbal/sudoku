import { boardFromString, boardToString, cloneBoard, maskOfDigit } from '../game/board';
import { boardForPuzzle, generatePuzzle } from '../game/generator';
import { difficultyRank } from '../game/grading';
import { findFirstSolution } from '../game/solver';
import { applyTechniqueResult } from '../game/techniques/apply';
import { TECHNIQUE_LADDER, techniqueById } from '../game/techniques/registry';
import { DIFFICULTIES, EMPTY_CELL, type Difficulty } from '../game/types';
import {
  TECHNIQUE_NEGATIVE_FIXTURES,
  TECHNIQUE_POSITIVE_FIXTURES,
} from './fixtures/techniqueFixtures';

describe('technique ladder', () => {
  it('registers every technique exactly once', () => {
    const ids = TECHNIQUE_LADDER.map((technique) => technique.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('orders the ladder cheapest tier first', () => {
    // Grading depends on the cheapest technique that fires being tried first.
    // An expensive technique listed early would silently inflate every grade.
    const ranks = TECHNIQUE_LADDER.map((technique) => difficultyRank(technique.tier));
    const sortedRanks = [...ranks].sort((left, right) => left - right);
    expect(ranks).toEqual(sortedRanks);
  });

  it('covers all six tiers', () => {
    const tiersPresent = new Set(TECHNIQUE_LADDER.map((technique) => technique.tier));
    for (const difficulty of DIFFICULTIES) {
      expect(tiersPresent).toContain(difficulty);
    }
  });

  it('gives every technique a human-facing label', () => {
    for (const technique of TECHNIQUE_LADDER) {
      expect(technique.label.length).toBeGreaterThan(0);
    }
  });
});

describe('golden technique fixtures', () => {
  it('has a positive fixture for every registered technique', () => {
    const captured = new Set(
      TECHNIQUE_POSITIVE_FIXTURES.map((fixture) => fixture.technique),
    );
    for (const technique of TECHNIQUE_LADDER) {
      expect(captured).toContain(technique.id);
    }
  });

  it.each(TECHNIQUE_POSITIVE_FIXTURES.map((fixture) => [fixture.technique, fixture]))(
    '%s fires on its captured board with exactly the recorded deductions',
    (_techniqueId, fixture) => {
      const board = boardFromString(fixture.boardString);
      const result = techniqueById(fixture.technique).apply(board);

      expect(result).not.toBeNull();
      expect(result!.technique).toBe(fixture.technique);
      expect(result!.placements).toEqual(fixture.placements);
      expect(result!.eliminations).toEqual(fixture.eliminations);
      expect(result!.explanation).toBe(fixture.explanation);
    },
  );

  it.each(TECHNIQUE_POSITIVE_FIXTURES.map((fixture) => [fixture.technique, fixture]))(
    '%s reports at least one deduction when it fires',
    (_techniqueId, fixture) => {
      expect(fixture.placements.length + fixture.eliminations.length).toBeGreaterThan(0);
    },
  );

  it.each(TECHNIQUE_NEGATIVE_FIXTURES.map((fixture) => [fixture.technique, fixture]))(
    '%s stays silent on a board where its pattern is absent',
    (_techniqueId, fixture) => {
      const board = boardFromString(fixture.boardString);
      expect(techniqueById(fixture.technique).apply(board)).toBeNull();
    },
  );

  it('leaves the board untouched when a technique only inspects it', () => {
    for (const fixture of TECHNIQUE_POSITIVE_FIXTURES) {
      const board = boardFromString(fixture.boardString);
      const before = boardToString(board);
      const candidatesBefore = [...board.candidates];

      techniqueById(fixture.technique).apply(board);

      expect(boardToString(board)).toBe(before);
      expect([...board.candidates]).toEqual(candidatesBefore);
    }
  });
});

/**
 * The property that actually matters: a technique may fail to find something,
 * but it must never deduce something false. An over-firing technique produces
 * unsolvable puzzles, and those are miserable to debug from the UI — so every
 * deduction on every solve path is checked against the real solution.
 */
describe('technique soundness against the true solution', () => {
  const CORPUS: { difficulty: Difficulty; seedIndex: number }[] = DIFFICULTIES.flatMap(
    (difficulty) =>
      [0, 1].map((seedIndex) => ({ difficulty, seedIndex })),
  );

  it.each(CORPUS.map((entry) => [entry.difficulty, entry.seedIndex, entry]))(
    'never deduces a falsehood while solving a %s puzzle (seed %i)',
    (_difficulty, _seedIndex, entry) => {
      const puzzle = generatePuzzle(
        `soundness-${entry.difficulty}-${entry.seedIndex}`,
        entry.difficulty,
      );
      const solution = findFirstSolution(boardForPuzzle(puzzle))!;
      const board = boardForPuzzle(puzzle);

      for (let step = 0; step < 400; step += 1) {
        let appliedAnything = false;

        for (const technique of TECHNIQUE_LADDER) {
          const result = technique.apply(cloneBoard(board));
          if (result === null) {
            continue;
          }

          for (const placement of result.placements) {
            expect({
              technique: technique.id,
              cellIndex: placement.cellIndex,
              digit: placement.digit,
            }).toEqual({
              technique: technique.id,
              cellIndex: placement.cellIndex,
              digit: solution[placement.cellIndex],
            });
          }

          for (const elimination of result.eliminations) {
            // Eliminating the digit that actually belongs there is the one
            // unrecoverable bug: it makes the puzzle unsolvable.
            expect({
              technique: technique.id,
              cellIndex: elimination.cellIndex,
              removed: elimination.digit,
            }).not.toEqual({
              technique: technique.id,
              cellIndex: elimination.cellIndex,
              removed: solution[elimination.cellIndex],
            });
          }

          applyTechniqueResult(board, result);
          appliedAnything = true;
          break;
        }

        if (!appliedAnything) {
          break;
        }
      }
    },
  );
});

describe('technique candidate hygiene', () => {
  it('only ever eliminates candidates that are present', () => {
    for (const fixture of TECHNIQUE_POSITIVE_FIXTURES) {
      const board = boardFromString(fixture.boardString);
      for (const elimination of fixture.eliminations) {
        expect(board.digits[elimination.cellIndex]).toBe(EMPTY_CELL);
        expect(board.candidates[elimination.cellIndex] & maskOfDigit(elimination.digit)).not.toBe(
          0,
        );
      }
    }
  });

  it('only ever places into empty cells', () => {
    for (const fixture of TECHNIQUE_POSITIVE_FIXTURES) {
      const board = boardFromString(fixture.boardString);
      for (const placement of fixture.placements) {
        expect(board.digits[placement.cellIndex]).toBe(EMPTY_CELL);
      }
    }
  });
});
