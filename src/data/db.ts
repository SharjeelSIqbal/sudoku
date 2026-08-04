/**
 * The SQLite handle and migration runner.
 *
 * Screens never import this — they go through the domain modules beside it
 * (`games.ts`, `stats.ts`, …). That indirection is what lets a sync adapter be
 * added later without touching a single screen.
 */

import * as SQLite from 'expo-sqlite';
import { randomUUID } from 'expo-crypto';

import { MIGRATIONS } from './migrations';

const DATABASE_NAME = 'sudoku.db';

let databasePromise: Promise<SQLite.SQLiteDatabase> | null = null;
let cachedDeviceId: string | null = null;

async function currentSchemaVersion(
  database: SQLite.SQLiteDatabase,
): Promise<number> {
  const row = await database.getFirstAsync<{ user_version: number }>(
    'PRAGMA user_version',
  );
  return row?.user_version ?? 0;
}

async function runMigrations(database: SQLite.SQLiteDatabase): Promise<void> {
  const startingVersion = await currentSchemaVersion(database);

  for (const migration of MIGRATIONS) {
    if (migration.version <= startingVersion) {
      continue;
    }

    // Each migration is one transaction: a half-applied schema change is far
    // worse than a failed boot, because the next launch cannot tell what state
    // it is in.
    await database.withTransactionAsync(async () => {
      for (const statement of migration.statements) {
        await database.execAsync(statement);
      }
    });
    await database.execAsync(`PRAGMA user_version = ${migration.version}`);
  }
}

export async function getDatabase(): Promise<SQLite.SQLiteDatabase> {
  if (databasePromise === null) {
    databasePromise = (async () => {
      const database = await SQLite.openDatabaseAsync(DATABASE_NAME);
      await database.execAsync('PRAGMA foreign_keys = ON');
      await runMigrations(database);
      return database;
    })();
  }
  return databasePromise;
}

/**
 * A stable per-install identifier stamped onto every row.
 *
 * Unused today. It exists so that when two devices eventually meet, their rows
 * can be told apart — adding identity to rows that already exist is far harder
 * than carrying it from the first write.
 */
export function deviceId(): string {
  if (cachedDeviceId === null) {
    cachedDeviceId = randomUUID();
  }
  return cachedDeviceId;
}

/** Overrides the device id, so a stored one survives reinstall-free restarts. */
export function setDeviceId(identifier: string): void {
  cachedDeviceId = identifier;
}

export function newRecordId(): string {
  return randomUUID();
}

export function nowIsoString(): string {
  return new Date().toISOString();
}

/** Booleans cross into SQLite as 0/1 and must come back out the same way. */
export function toSqliteBoolean(value: boolean): number {
  return value ? 1 : 0;
}

export function fromSqliteBoolean(value: number): boolean {
  return value === 1;
}

/** Test seam: drops the cached handle so a fresh database can be opened. */
export function resetDatabaseForTesting(): void {
  databasePromise = null;
  cachedDeviceId = null;
}
