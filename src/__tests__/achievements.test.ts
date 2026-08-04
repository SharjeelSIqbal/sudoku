import { DIFFICULTIES } from '../game/types';
import {
  ACHIEVEMENTS,
  achievementById,
  earnedAchievementIds,
  emptyProgressSnapshot,
  newlyEarnedAchievementIds,
  type ProgressSnapshot,
} from '../utils/achievements';

function snapshotWith(overrides: Partial<ProgressSnapshot> = {}): ProgressSnapshot {
  return { ...emptyProgressSnapshot(), ...overrides };
}

describe('achievement definitions', () => {
  it('gives every achievement a unique id', () => {
    const ids = ACHIEVEMENTS.map((achievement) => achievement.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('gives every achievement a title and a description', () => {
    for (const achievement of ACHIEVEMENTS) {
      expect(achievement.title.length).toBeGreaterThan(0);
      expect(achievement.description.length).toBeGreaterThan(0);
    }
  });

  it('finds an achievement by id, and nothing by a made-up one', () => {
    expect(achievementById(ACHIEVEMENTS[0].id)).toBe(ACHIEVEMENTS[0]);
    expect(achievementById('no-such-achievement')).toBeUndefined();
  });

  it('covers every difficulty tier', () => {
    for (const difficulty of DIFFICULTIES) {
      expect(
        ACHIEVEMENTS.some((achievement) => achievement.id === `tier-${difficulty}`),
      ).toBe(true);
    }
  });

  it('earns nothing at all on a fresh install', () => {
    expect(earnedAchievementIds(emptyProgressSnapshot())).toEqual([]);
  });
});

/**
 * The rule from AGENTS.md, asserted rather than trusted: zen games are
 * unscored and untimed, so anything measuring points, speed or streaks must
 * not count them.
 */
describe('the zen boundary', () => {
  it('marks every points, streak or speed achievement as ranked-only', () => {
    const measuresRankedOnlyThings = (identifier: string): boolean =>
      identifier.startsWith('points-') ||
      identifier.startsWith('streak-') ||
      identifier.startsWith('daily-') ||
      identifier.startsWith('flawless-') ||
      identifier.startsWith('unaided-') ||
      identifier.startsWith('hard-mode-') ||
      identifier === 'master-flawless';

    for (const achievement of ACHIEVEMENTS) {
      if (measuresRankedOnlyThings(achievement.id)) {
        expect({ id: achievement.id, countsZen: achievement.countsZenGames }).toEqual({
          id: achievement.id,
          countsZen: false,
        });
      }
    }
  });

  it('lets solve-count achievements include zen games', () => {
    const solveCount = ACHIEVEMENTS.find((achievement) => achievement.id === 'solved-1')!;
    expect(solveCount.countsZenGames).toBe(true);
  });

  it('does not award a points achievement to a zen-only player', () => {
    // A zen-only player has solves but no points, so the solve milestone lands
    // and the points one must not.
    const zenOnly = snapshotWith({ totalSolved: 60, totalPoints: 0 });
    const earned = earnedAchievementIds(zenOnly);

    expect(earned).toContain('solved-50');
    expect(earned).not.toContain('points-ten-thousand');
  });
});

describe('earning achievements', () => {
  it('awards the first-solve milestone on a single solve', () => {
    expect(earnedAchievementIds(snapshotWith({ totalSolved: 1 }))).toContain('solved-1');
  });

  it('awards every milestone at or below the current count', () => {
    const earned = earnedAchievementIds(snapshotWith({ totalSolved: 100 }));
    expect(earned).toContain('solved-1');
    expect(earned).toContain('solved-50');
    expect(earned).toContain('solved-100');
    expect(earned).not.toContain('solved-500');
  });

  it('awards a tier achievement for solving that tier', () => {
    const snapshot = emptyProgressSnapshot();
    snapshot.solvedByDifficulty.master = 1;
    expect(earnedAchievementIds(snapshot)).toContain('tier-master');
  });

  it('awards the full-ladder achievement only once every tier is solved', () => {
    const partial = emptyProgressSnapshot();
    for (const difficulty of DIFFICULTIES.slice(0, 5)) {
      partial.solvedByDifficulty[difficulty] = 1;
    }
    expect(earnedAchievementIds(partial)).not.toContain('all-tiers');

    const complete = emptyProgressSnapshot();
    for (const difficulty of DIFFICULTIES) {
      complete.solvedByDifficulty[difficulty] = 1;
    }
    expect(earnedAchievementIds(complete)).toContain('all-tiers');
  });

  it('awards streak achievements off the longest streak, not the current one', () => {
    // A player whose streak has since lapsed keeps what they earned.
    const lapsed = snapshotWith({ currentStreakDays: 0, longestStreakDays: 30 });
    const earned = earnedAchievementIds(lapsed);

    expect(earned).toContain('streak-three');
    expect(earned).toContain('streak-week');
    expect(earned).toContain('streak-month');
  });

  it('awards the hard-mode achievements separately', () => {
    const oneToggle = snapshotWith({ hardModeSolves: 1 });
    expect(earnedAchievementIds(oneToggle)).toContain('hard-mode-one');
    expect(earnedAchievementIds(oneToggle)).not.toContain('hard-mode-both');

    const bothToggles = snapshotWith({ hardModeSolves: 1, fullHardModeSolves: 1 });
    expect(earnedAchievementIds(bothToggles)).toContain('hard-mode-both');
  });
});

describe('newly earned achievements', () => {
  it('reports only what was not already held', () => {
    const progress = snapshotWith({ totalSolved: 10 });
    const newly = newlyEarnedAchievementIds(['solved-1'], progress);

    expect(newly).toContain('solved-10');
    expect(newly).not.toContain('solved-1');
  });

  it('reports nothing when nothing changed', () => {
    const progress = snapshotWith({ totalSolved: 10 });
    const alreadyEarned = earnedAchievementIds(progress);
    expect(newlyEarnedAchievementIds(alreadyEarned, progress)).toEqual([]);
  });

  it('reports everything on a first win', () => {
    const progress = snapshotWith({ totalSolved: 1 });
    expect(newlyEarnedAchievementIds([], progress)).toContain('solved-1');
  });
});
