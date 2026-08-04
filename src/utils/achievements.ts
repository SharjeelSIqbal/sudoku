/**
 * Achievement definitions.
 *
 * Every achievement declares whether zen games count toward it. That is the
 * rule from AGENTS.md made explicit in the type: zen is unscored and untimed,
 * so it can advance "how many puzzles have you solved" but must never advance
 * anything about points, speed or streaks. Leaving it implicit is how the two
 * sides quietly drift apart.
 *
 * Nothing here is punitive and nothing expires. This is a game for enjoying,
 * so achievements mark things the player did, not things they failed to do.
 */

import { DIFFICULTIES, type Difficulty } from '../game/types';

export type AchievementId = string;

/**
 * Everything an achievement is allowed to look at. A single snapshot type
 * keeps the definitions declarative and makes them trivial to test — no
 * database, no context, just a plain object in and a boolean out.
 */
export interface ProgressSnapshot {
  /** Completed puzzles, including zen. */
  totalSolved: number;
  /** Completed puzzles per tier, including zen. */
  solvedByDifficulty: Record<Difficulty, number>;
  /** Completed ranked puzzles per tier. */
  rankedSolvedByDifficulty: Record<Difficulty, number>;
  /** Ranked solves with no wrong entries. */
  flawlessSolves: number;
  /** Ranked solves with no hints. */
  hintFreeSolves: number;
  /** Ranked solves with at least one hard-mode toggle on. */
  hardModeSolves: number;
  /** Ranked solves with both hard-mode toggles on. */
  fullHardModeSolves: number;
  currentStreakDays: number;
  longestStreakDays: number;
  totalPoints: number;
  dailyChallengesCompleted: number;
  /** Best ranked time per tier, in seconds. */
  fastestSecondsByDifficulty: Partial<Record<Difficulty, number>>;
}

export interface AchievementDefinition {
  id: AchievementId;
  title: string;
  description: string;
  /**
   * False for anything measuring points, speed or streaks — zen games earn
   * none of those, so counting them would be a lie.
   */
  countsZenGames: boolean;
  isEarned: (progress: ProgressSnapshot) => boolean;
}

export function emptyProgressSnapshot(): ProgressSnapshot {
  const zeroByDifficulty = () =>
    Object.fromEntries(DIFFICULTIES.map((difficulty) => [difficulty, 0])) as Record<
      Difficulty,
      number
    >;

  return {
    totalSolved: 0,
    solvedByDifficulty: zeroByDifficulty(),
    rankedSolvedByDifficulty: zeroByDifficulty(),
    flawlessSolves: 0,
    hintFreeSolves: 0,
    hardModeSolves: 0,
    fullHardModeSolves: 0,
    currentStreakDays: 0,
    longestStreakDays: 0,
    totalPoints: 0,
    dailyChallengesCompleted: 0,
    fastestSecondsByDifficulty: {},
  };
}

/** Milestones on total puzzles solved. */
const SOLVE_COUNT_MILESTONES = [1, 10, 50, 100, 500] as const;

const SOLVE_COUNT_TITLES: Record<number, string> = {
  1: 'First light',
  10: 'Getting the hang of it',
  50: 'Regular',
  100: 'Century',
  500: 'Devoted',
};

const TIER_TITLES: Record<Difficulty, string> = {
  easy: 'Easy does it',
  medium: 'Middle ground',
  hard: 'Hard won',
  expert: 'Expert hands',
  extreme: 'Extremist',
  master: 'Master',
};

export const ACHIEVEMENTS: readonly AchievementDefinition[] = [
  ...SOLVE_COUNT_MILESTONES.map((milestone) => ({
    id: `solved-${milestone}`,
    title: SOLVE_COUNT_TITLES[milestone],
    description:
      milestone === 1 ? 'Solve your first puzzle.' : `Solve ${milestone} puzzles.`,
    countsZenGames: true,
    isEarned: (progress: ProgressSnapshot) => progress.totalSolved >= milestone,
  })),

  ...DIFFICULTIES.map((difficulty) => ({
    id: `tier-${difficulty}`,
    title: TIER_TITLES[difficulty],
    description: `Solve a ${difficulty} puzzle.`,
    countsZenGames: true,
    isEarned: (progress: ProgressSnapshot) =>
      progress.solvedByDifficulty[difficulty] >= 1,
  })),

  ...DIFFICULTIES.map((difficulty) => ({
    id: `tier-ten-${difficulty}`,
    title: `${TIER_TITLES[difficulty]} ×10`,
    description: `Solve ten ${difficulty} puzzles.`,
    countsZenGames: true,
    isEarned: (progress: ProgressSnapshot) =>
      progress.solvedByDifficulty[difficulty] >= 10,
  })),

  {
    id: 'flawless-one',
    title: 'Spotless',
    description: 'Finish a ranked puzzle without a single wrong entry.',
    countsZenGames: false,
    isEarned: (progress) => progress.flawlessSolves >= 1,
  },
  {
    id: 'flawless-ten',
    title: 'Precision',
    description: 'Finish ten ranked puzzles with no wrong entries.',
    countsZenGames: false,
    isEarned: (progress) => progress.flawlessSolves >= 10,
  },
  {
    id: 'unaided-one',
    title: 'No help needed',
    description: 'Finish a ranked puzzle without a hint.',
    countsZenGames: false,
    isEarned: (progress) => progress.hintFreeSolves >= 1,
  },
  {
    id: 'hard-mode-one',
    title: 'Making it harder',
    description: 'Finish a puzzle with a hard-mode setting switched on.',
    countsZenGames: false,
    isEarned: (progress) => progress.hardModeSolves >= 1,
  },
  {
    id: 'hard-mode-both',
    title: 'No safety net',
    description: 'Finish a puzzle with both hard-mode settings switched on.',
    countsZenGames: false,
    isEarned: (progress) => progress.fullHardModeSolves >= 1,
  },
  {
    id: 'master-flawless',
    title: 'Grandmaster',
    description: 'Finish a master puzzle with no wrong entries and no hints.',
    countsZenGames: false,
    isEarned: (progress) =>
      progress.rankedSolvedByDifficulty.master >= 1 &&
      progress.flawlessSolves >= 1 &&
      progress.hintFreeSolves >= 1,
  },

  {
    id: 'streak-three',
    title: 'Three in a row',
    description: 'Play three days running.',
    countsZenGames: false,
    isEarned: (progress) => progress.longestStreakDays >= 3,
  },
  {
    id: 'streak-week',
    title: 'A full week',
    description: 'Play seven days running.',
    countsZenGames: false,
    isEarned: (progress) => progress.longestStreakDays >= 7,
  },
  {
    id: 'streak-month',
    title: 'A whole month',
    description: 'Play thirty days running.',
    countsZenGames: false,
    isEarned: (progress) => progress.longestStreakDays >= 30,
  },

  {
    id: 'daily-one',
    title: "Today's puzzle",
    description: 'Finish a daily challenge.',
    countsZenGames: false,
    isEarned: (progress) => progress.dailyChallengesCompleted >= 1,
  },
  {
    id: 'daily-ten',
    title: 'Daily habit',
    description: 'Finish ten daily challenges.',
    countsZenGames: false,
    isEarned: (progress) => progress.dailyChallengesCompleted >= 10,
  },

  {
    id: 'points-ten-thousand',
    title: 'Ten thousand',
    description: 'Earn 10,000 points.',
    countsZenGames: false,
    isEarned: (progress) => progress.totalPoints >= 10000,
  },
  {
    id: 'all-tiers',
    title: 'The full ladder',
    description: 'Solve a puzzle at every difficulty, easy through master.',
    countsZenGames: true,
    isEarned: (progress) =>
      DIFFICULTIES.every((difficulty) => progress.solvedByDifficulty[difficulty] >= 1),
  },
];

const ACHIEVEMENT_BY_ID = new Map(
  ACHIEVEMENTS.map((achievement) => [achievement.id, achievement]),
);

export function achievementById(id: AchievementId): AchievementDefinition | undefined {
  return ACHIEVEMENT_BY_ID.get(id);
}

/** Every achievement the snapshot now satisfies. */
export function earnedAchievementIds(progress: ProgressSnapshot): AchievementId[] {
  return ACHIEVEMENTS.filter((achievement) => achievement.isEarned(progress)).map(
    (achievement) => achievement.id,
  );
}

/** Achievements earned now that were not earned before — what to celebrate. */
export function newlyEarnedAchievementIds(
  previouslyEarned: Iterable<AchievementId>,
  progress: ProgressSnapshot,
): AchievementId[] {
  const alreadyEarned = new Set(previouslyEarned);
  return earnedAchievementIds(progress).filter((id) => !alreadyEarned.has(id));
}
