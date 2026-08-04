/**
 * Which achievements have been unlocked, and when.
 *
 * Only the unlock is stored, never the progress toward it — progress is
 * recomputed from game history, so a counter can never drift away from the
 * games that produced it.
 */

import { type AchievementId } from '../utils/achievements';
import { deviceId, getDatabase, nowIsoString } from './db';

export interface AchievementUnlock {
  id: AchievementId;
  unlockedAt: string;
}

export async function listUnlockedAchievements(): Promise<AchievementUnlock[]> {
  const database = await getDatabase();
  return database.getAllAsync<AchievementUnlock>(
    'SELECT id, unlockedAt FROM achievement_unlocks ORDER BY unlockedAt DESC',
  );
}

export async function listUnlockedAchievementIds(): Promise<AchievementId[]> {
  return (await listUnlockedAchievements()).map((unlock) => unlock.id);
}

/**
 * Records unlocks, ignoring any already present. `INSERT OR IGNORE` keeps the
 * original `unlockedAt` rather than resetting it, so the achievements screen
 * can honestly say when something was first earned.
 */
export async function unlockAchievements(ids: readonly AchievementId[]): Promise<void> {
  if (ids.length === 0) {
    return;
  }

  const database = await getDatabase();
  const unlockedAt = nowIsoString();
  const identifier = deviceId();

  await database.withTransactionAsync(async () => {
    for (const id of ids) {
      await database.runAsync(
        `INSERT OR IGNORE INTO achievement_unlocks (id, unlockedAt, updatedAt, deviceId)
         VALUES (?, ?, ?, ?)`,
        [id, unlockedAt, unlockedAt, identifier],
      );
    }
  });
}
