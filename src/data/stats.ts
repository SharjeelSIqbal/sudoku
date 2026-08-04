/**
 * Aggregate statistics, computed by query.
 *
 * These are SQL aggregates rather than a reduce over every game in memory,
 * which is the whole reason history lives in SQLite instead of a JSON blob in
 * AsyncStorage: the stats screen stays instant as the history grows.
 */

import { DIFFICULTIES, type Difficulty } from '../game/types';
import { emptyProgressSnapshot, type ProgressSnapshot } from '../utils/achievements';
import { getDatabase } from './db';

export interface DifficultyStats {
  difficulty: Difficulty;
  gamesPlayed: number;
  gamesCompleted: number;
  bestSeconds: number | null;
  averageSeconds: number | null;
  bestPoints: number;
}

export async function statsByDifficulty(): Promise<DifficultyStats[]> {
  const database = await getDatabase();
  const rows = await database.getAllAsync<{
    difficulty: string;
    gamesPlayed: number;
    gamesCompleted: number;
    bestSeconds: number | null;
    averageSeconds: number | null;
    bestPoints: number | null;
  }>(
    `SELECT
       difficulty,
       COUNT(*) AS gamesPlayed,
       SUM(completed) AS gamesCompleted,
       MIN(CASE WHEN completed = 1 AND mode = 'ranked' THEN elapsedSeconds END) AS bestSeconds,
       AVG(CASE WHEN completed = 1 AND mode = 'ranked' THEN elapsedSeconds END) AS averageSeconds,
       MAX(points) AS bestPoints
     FROM games
     GROUP BY difficulty`,
  );

  const byDifficulty = new Map(rows.map((row) => [row.difficulty, row]));

  return DIFFICULTIES.map((difficulty) => {
    const row = byDifficulty.get(difficulty);
    return {
      difficulty,
      gamesPlayed: row?.gamesPlayed ?? 0,
      gamesCompleted: row?.gamesCompleted ?? 0,
      bestSeconds: row?.bestSeconds ?? null,
      averageSeconds:
        row?.averageSeconds == null ? null : Math.round(row.averageSeconds),
      bestPoints: row?.bestPoints ?? 0,
    };
  });
}

export async function totalPointsEarned(): Promise<number> {
  const database = await getDatabase();
  const row = await database.getFirstAsync<{ total: number | null }>(
    'SELECT SUM(points) AS total FROM games',
  );
  return row?.total ?? 0;
}

/**
 * Builds the snapshot the achievement definitions are evaluated against.
 *
 * Note which counters include zen games and which do not — that split is the
 * rule that zen advances "puzzles solved" but never points, speed or streaks.
 */
export async function buildProgressSnapshot(
  currentStreakDays: number,
  longestStreakDays: number,
): Promise<ProgressSnapshot> {
  const database = await getDatabase();
  const snapshot = emptyProgressSnapshot();

  const perDifficulty = await database.getAllAsync<{
    difficulty: string;
    solved: number;
    rankedSolved: number;
    fastestSeconds: number | null;
  }>(
    `SELECT
       difficulty,
       SUM(CASE WHEN completed = 1 THEN 1 ELSE 0 END) AS solved,
       SUM(CASE WHEN completed = 1 AND mode = 'ranked' THEN 1 ELSE 0 END) AS rankedSolved,
       MIN(CASE WHEN completed = 1 AND mode = 'ranked' THEN elapsedSeconds END) AS fastestSeconds
     FROM games
     GROUP BY difficulty`,
  );

  for (const row of perDifficulty) {
    const difficulty = row.difficulty as Difficulty;
    if (!DIFFICULTIES.includes(difficulty)) {
      continue;
    }
    snapshot.solvedByDifficulty[difficulty] = row.solved;
    snapshot.rankedSolvedByDifficulty[difficulty] = row.rankedSolved;
    if (row.fastestSeconds !== null) {
      snapshot.fastestSecondsByDifficulty[difficulty] = row.fastestSeconds;
    }
  }

  const totals = await database.getFirstAsync<{
    totalSolved: number | null;
    flawlessSolves: number | null;
    hintFreeSolves: number | null;
    hardModeSolves: number | null;
    fullHardModeSolves: number | null;
    totalPoints: number | null;
    dailyChallengesCompleted: number | null;
  }>(
    `SELECT
       SUM(CASE WHEN completed = 1 THEN 1 ELSE 0 END) AS totalSolved,
       SUM(CASE WHEN completed = 1 AND mode = 'ranked' AND wrongEntryCount = 0 THEN 1 ELSE 0 END) AS flawlessSolves,
       SUM(CASE WHEN completed = 1 AND mode = 'ranked' AND hintCount = 0 THEN 1 ELSE 0 END) AS hintFreeSolves,
       SUM(CASE WHEN completed = 1 AND mode = 'ranked' AND (instantValidationEnabled = 0 OR strikeLimitEnabled = 1) THEN 1 ELSE 0 END) AS hardModeSolves,
       SUM(CASE WHEN completed = 1 AND mode = 'ranked' AND instantValidationEnabled = 0 AND strikeLimitEnabled = 1 THEN 1 ELSE 0 END) AS fullHardModeSolves,
       SUM(points) AS totalPoints,
       SUM(CASE WHEN completed = 1 AND isDailyChallenge = 1 THEN 1 ELSE 0 END) AS dailyChallengesCompleted
     FROM games`,
  );

  snapshot.totalSolved = totals?.totalSolved ?? 0;
  snapshot.flawlessSolves = totals?.flawlessSolves ?? 0;
  snapshot.hintFreeSolves = totals?.hintFreeSolves ?? 0;
  snapshot.hardModeSolves = totals?.hardModeSolves ?? 0;
  snapshot.fullHardModeSolves = totals?.fullHardModeSolves ?? 0;
  snapshot.totalPoints = totals?.totalPoints ?? 0;
  snapshot.dailyChallengesCompleted = totals?.dailyChallengesCompleted ?? 0;
  snapshot.currentStreakDays = currentStreakDays;
  snapshot.longestStreakDays = longestStreakDays;

  return snapshot;
}
