/**
 * Game history: one row per finished or abandoned game.
 *
 * Everything the stats and streak screens show is derived from this table by
 * query rather than from a running counter, so a number that looks wrong can
 * always be recomputed rather than only corrected.
 */

import { type Difficulty, type PlayMode } from '../game/types';
import { type DayKey } from '../utils/dates';
import {
  deviceId,
  fromSqliteBoolean,
  getDatabase,
  newRecordId,
  nowIsoString,
  toSqliteBoolean,
} from './db';

export interface GameRecord {
  id: string;
  playedAt: string;
  dayKey: DayKey;
  difficulty: Difficulty;
  mode: PlayMode;
  completed: boolean;
  elapsedSeconds: number;
  points: number;
  wrongEntryCount: number;
  repeatedWrongEntryCount: number;
  unjustifiedPlacementCount: number;
  hintCount: number;
  instantValidationEnabled: boolean;
  strikeLimitEnabled: boolean;
  autoCandidatesUsed: boolean;
  isDailyChallenge: boolean;
  seed: string;
}

interface GameRow {
  id: string;
  playedAt: string;
  dayKey: string;
  difficulty: string;
  mode: string;
  completed: number;
  elapsedSeconds: number;
  points: number;
  wrongEntryCount: number;
  repeatedWrongEntryCount: number;
  unjustifiedPlacementCount: number;
  hintCount: number;
  instantValidationEnabled: number;
  strikeLimitEnabled: number;
  autoCandidatesUsed: number;
  isDailyChallenge: number;
  seed: string;
}

export function rowToGame(row: GameRow): GameRecord {
  return {
    id: row.id,
    playedAt: row.playedAt,
    dayKey: row.dayKey,
    difficulty: row.difficulty as Difficulty,
    mode: row.mode as PlayMode,
    completed: fromSqliteBoolean(row.completed),
    elapsedSeconds: row.elapsedSeconds,
    points: row.points,
    wrongEntryCount: row.wrongEntryCount,
    repeatedWrongEntryCount: row.repeatedWrongEntryCount,
    unjustifiedPlacementCount: row.unjustifiedPlacementCount,
    hintCount: row.hintCount,
    instantValidationEnabled: fromSqliteBoolean(row.instantValidationEnabled),
    strikeLimitEnabled: fromSqliteBoolean(row.strikeLimitEnabled),
    autoCandidatesUsed: fromSqliteBoolean(row.autoCandidatesUsed),
    isDailyChallenge: fromSqliteBoolean(row.isDailyChallenge),
    seed: row.seed,
  };
}

export async function insertGame(
  game: Omit<GameRecord, 'id'> & { id?: string },
): Promise<GameRecord> {
  const database = await getDatabase();
  const record: GameRecord = { ...game, id: game.id ?? newRecordId() };

  await database.runAsync(
    `INSERT INTO games (
      id, playedAt, dayKey, difficulty, mode, completed, elapsedSeconds, points,
      wrongEntryCount, repeatedWrongEntryCount, unjustifiedPlacementCount, hintCount,
      instantValidationEnabled, strikeLimitEnabled, autoCandidatesUsed,
      isDailyChallenge, seed, updatedAt, deviceId
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      record.id,
      record.playedAt,
      record.dayKey,
      record.difficulty,
      record.mode,
      toSqliteBoolean(record.completed),
      record.elapsedSeconds,
      record.points,
      record.wrongEntryCount,
      record.repeatedWrongEntryCount,
      record.unjustifiedPlacementCount,
      record.hintCount,
      toSqliteBoolean(record.instantValidationEnabled),
      toSqliteBoolean(record.strikeLimitEnabled),
      toSqliteBoolean(record.autoCandidatesUsed),
      toSqliteBoolean(record.isDailyChallenge),
      record.seed,
      nowIsoString(),
      deviceId(),
    ],
  );

  return record;
}

export async function listRecentGames(limit = 50): Promise<GameRecord[]> {
  const database = await getDatabase();
  const rows = await database.getAllAsync<GameRow>(
    'SELECT * FROM games ORDER BY playedAt DESC LIMIT ?',
    [limit],
  );
  return rows.map(rowToGame);
}

/**
 * The days with a completed *ranked* game — the input to the streak walk.
 * Zen games are excluded on purpose: they are unscored, and an unscored game
 * does not advance a streak.
 */
export async function listRankedPlayDayKeys(): Promise<DayKey[]> {
  const database = await getDatabase();
  const rows = await database.getAllAsync<{ dayKey: string }>(
    "SELECT DISTINCT dayKey FROM games WHERE completed = 1 AND mode = 'ranked' ORDER BY dayKey",
  );
  return rows.map((row) => row.dayKey);
}

export async function hasCompletedDailyChallenge(dayKey: DayKey): Promise<boolean> {
  const database = await getDatabase();
  const row = await database.getFirstAsync<{ total: number }>(
    'SELECT COUNT(*) AS total FROM games WHERE dayKey = ? AND isDailyChallenge = 1 AND completed = 1',
    [dayKey],
  );
  return (row?.total ?? 0) > 0;
}
