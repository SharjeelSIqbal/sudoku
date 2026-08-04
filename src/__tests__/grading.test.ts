import { boardFromString } from '../game/board';
import {
  difficultyRank,
  findNextHint,
  gradePuzzle,
  harderDifficulty,
  isAtMostDifficulty,
  solveLogically,
} from '../game/grading';
import { DIFFICULTIES } from '../game/types';
import { GOLDEN_PUZZLE_FIXTURES } from './fixtures/techniqueFixtures';

const SOLVED_GRID =
  '534678912672195348198342567859761423426853791713924856961537284287419635345286179';

describe('difficulty ordering', () => {
  it('ranks the tiers easiest to hardest', () => {
    const ranks = DIFFICULTIES.map(difficultyRank);
    expect(ranks).toEqual([0, 1, 2, 3, 4, 5]);
  });

  it('compares tiers by rank, not alphabetically', () => {
    expect(isAtMostDifficulty('easy', 'master')).toBe(true);
    expect(isAtMostDifficulty('master', 'easy')).toBe(false);
    expect(harderDifficulty('medium', 'extreme')).toBe('extreme');
    expect(harderDifficulty('hard', 'easy')).toBe('hard');
  });
});

/**
 * The golden puzzles are frozen output from the generator. If a technique
 * change re-grades one of them, this test fails — which is the point. Confirm
 * the change was intended, then regenerate with `npm run fixtures`.
 */
describe('golden puzzle grades', () => {
  it.each(GOLDEN_PUZZLE_FIXTURES.map((fixture) => [fixture.difficulty, fixture]))(
    'still grades the frozen %s puzzle at that tier',
    (_difficulty, fixture) => {
      expect(gradePuzzle(boardFromString(fixture.givens))).toBe(fixture.difficulty);
    },
  );

  it.each(GOLDEN_PUZZLE_FIXTURES.map((fixture) => [fixture.difficulty, fixture]))(
    'still solves the frozen %s puzzle by logic alone',
    (_difficulty, fixture) => {
      const outcome = solveLogically(boardFromString(fixture.givens));
      expect(outcome.solved).toBe(true);
      expect(outcome.steps.length).toBeGreaterThan(0);
    },
  );

  it.each(GOLDEN_PUZZLE_FIXTURES.map((fixture) => [fixture.difficulty, fixture]))(
    'records the hardest tier it needed for the frozen %s puzzle',
    (_difficulty, fixture) => {
      const outcome = solveLogically(boardFromString(fixture.givens));
      expect(outcome.hardestTierUsed).toBe(fixture.difficulty);
    },
  );
});

describe('capped solving', () => {
  it('cannot finish a hard puzzle with only easy techniques', () => {
    const harderFixture = GOLDEN_PUZZLE_FIXTURES.find(
      (fixture) => fixture.difficulty === 'extreme',
    )!;
    const outcome = solveLogically(boardFromString(harderFixture.givens), {
      maximumDifficulty: 'easy',
    });
    expect(outcome.solved).toBe(false);
  });

  it('never applies a technique above the cap', () => {
    const masterFixture = GOLDEN_PUZZLE_FIXTURES.find(
      (fixture) => fixture.difficulty === 'master',
    )!;
    const outcome = solveLogically(boardFromString(masterFixture.givens), {
      maximumDifficulty: 'hard',
    });
    expect(outcome.techniqueCounts.forcingChain).toBeUndefined();
    expect(outcome.techniqueCounts.xWing).toBeUndefined();
  });
});

describe('grading edge cases', () => {
  it('grades an already-complete grid as easy rather than unsolvable', () => {
    expect(gradePuzzle(boardFromString(SOLVED_GRID))).toBe('easy');
  });

  it('returns null when the ladder cannot finish without guessing', () => {
    // An empty grid is not hard, it is ambiguous — the ladder must refuse it
    // rather than pick something arbitrary.
    expect(gradePuzzle(boardFromString('.'.repeat(81)))).toBeNull();
  });
});

describe('hints', () => {
  it('offers a next step with an explanation on an unsolved puzzle', () => {
    const fixture = GOLDEN_PUZZLE_FIXTURES.find(
      (candidate) => candidate.difficulty === 'medium',
    )!;
    const hint = findNextHint(boardFromString(fixture.givens), 'medium');

    expect(hint).not.toBeNull();
    expect(hint!.explanation.length).toBeGreaterThan(0);
    expect(hint!.placements.length + hint!.eliminations.length).toBeGreaterThan(0);
  });

  it('names the technique so a hint teaches rather than just fills a cell', () => {
    const fixture = GOLDEN_PUZZLE_FIXTURES.find(
      (candidate) => candidate.difficulty === 'easy',
    )!;
    const hint = findNextHint(boardFromString(fixture.givens), 'easy');
    expect(hint!.technique).toBeTruthy();
  });

  it('has nothing to offer on a finished grid', () => {
    expect(findNextHint(boardFromString(SOLVED_GRID), 'master')).toBeNull();
  });
});
