/**
 * The single-row checkpoint of the game in progress.
 *
 * Written on every move, not just on backgrounding. Losing a forty-minute
 * Master board to a crash or an OS kill is the worst thing this app could do
 * to someone, and a checkpoint is cheap by comparison.
 */

import { type Difficulty, type PlayMode } from '../game/types';
import { deviceId, getDatabase, nowIsoString } from './db';

export interface SavedGameSnapshot {
  seed: string;
  difficulty: Difficulty;
  mode: PlayMode;
  isDailyChallenge: boolean;
  /** 81 characters, `.` for an empty cell. */
  givens: string;
  solution: string;
  /** The player's own entries, 81 characters. */
  entries: string;
  /** 81 candidate masks for the player's pencil marks. */
  pencilMarks: number[];
  elapsedSeconds: number;
  wrongEntryCount: number;
  repeatedWrongEntryCount: number;
  unjustifiedPlacementCount: number;
  hintCount: number;
  strikeCount: number;
  /** Cells the player has already got wrong at least once. */
  previouslyWrongCells: number[];
  instantValidationEnabled: boolean;
  strikeLimitEnabled: boolean;
  autoCandidatesUsed: boolean;
  startedAt: string;
}

export async function saveGameSnapshot(snapshot: SavedGameSnapshot): Promise<void> {
  const database = await getDatabase();
  const timestamp = nowIsoString();

  await database.runAsync(
    `INSERT INTO saved_game (id, payload, updatedAt, deviceId)
     VALUES (1, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET payload = excluded.payload, updatedAt = excluded.updatedAt`,
    [JSON.stringify(snapshot), timestamp, deviceId()],
  );
}

export async function loadGameSnapshot(): Promise<SavedGameSnapshot | null> {
  const database = await getDatabase();
  const row = await database.getFirstAsync<{ payload: string }>(
    'SELECT payload FROM saved_game WHERE id = 1',
  );

  if (!row) {
    return null;
  }

  try {
    return JSON.parse(row.payload) as SavedGameSnapshot;
  } catch {
    // A checkpoint written by an older build may no longer parse. Losing the
    // resume is bad; refusing to launch is worse.
    return null;
  }
}

export async function clearGameSnapshot(): Promise<void> {
  const database = await getDatabase();
  await database.runAsync('DELETE FROM saved_game WHERE id = 1');
}
