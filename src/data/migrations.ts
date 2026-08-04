/**
 * Schema, as an ordered list of migrations applied on boot.
 *
 * Migrations are append-only and are never edited once committed — a released
 * build has already run them, and rewriting history here means the schema on a
 * player's phone stops matching what this file claims.
 *
 * Every row carries `id`, `updatedAt` and `deviceId`. Nothing reads `deviceId`
 * today; it is there because the app is local-first rather than local-forever,
 * and retrofitting identity onto rows that already exist is far more painful
 * than carrying it from the start.
 */

export interface Migration {
  /** Matches its index + 1; SQLite's `user_version` tracks the last applied. */
  version: number;
  name: string;
  statements: string[];
}

export const MIGRATIONS: readonly Migration[] = [
  {
    version: 1,
    name: 'initial schema',
    statements: [
      `CREATE TABLE IF NOT EXISTS games (
        id TEXT PRIMARY KEY NOT NULL,
        playedAt TEXT NOT NULL,
        dayKey TEXT NOT NULL,
        difficulty TEXT NOT NULL,
        mode TEXT NOT NULL,
        completed INTEGER NOT NULL,
        elapsedSeconds INTEGER NOT NULL,
        points INTEGER NOT NULL,
        wrongEntryCount INTEGER NOT NULL,
        repeatedWrongEntryCount INTEGER NOT NULL,
        unjustifiedPlacementCount INTEGER NOT NULL,
        hintCount INTEGER NOT NULL,
        instantValidationEnabled INTEGER NOT NULL,
        strikeLimitEnabled INTEGER NOT NULL,
        autoCandidatesUsed INTEGER NOT NULL,
        isDailyChallenge INTEGER NOT NULL,
        seed TEXT NOT NULL,
        updatedAt TEXT NOT NULL,
        deviceId TEXT NOT NULL
      )`,
      // Stats and streak queries both filter on these, and a table scan per
      // stats-screen render is exactly the cost SQLite was chosen to avoid.
      `CREATE INDEX IF NOT EXISTS games_by_day ON games (dayKey)`,
      `CREATE INDEX IF NOT EXISTS games_by_difficulty ON games (difficulty, completed)`,

      `CREATE TABLE IF NOT EXISTS achievement_unlocks (
        id TEXT PRIMARY KEY NOT NULL,
        unlockedAt TEXT NOT NULL,
        updatedAt TEXT NOT NULL,
        deviceId TEXT NOT NULL
      )`,

      // The pre-generated puzzle bank. Starting a game pops from here, which
      // is what keeps "new game" instant despite generation being expensive.
      `CREATE TABLE IF NOT EXISTS puzzle_bank (
        id TEXT PRIMARY KEY NOT NULL,
        difficulty TEXT NOT NULL,
        seed TEXT NOT NULL,
        givens TEXT NOT NULL,
        solution TEXT NOT NULL,
        clueCount INTEGER NOT NULL,
        createdAt TEXT NOT NULL,
        updatedAt TEXT NOT NULL,
        deviceId TEXT NOT NULL
      )`,
      `CREATE INDEX IF NOT EXISTS puzzle_bank_by_difficulty ON puzzle_bank (difficulty)`,

      // A single-row checkpoint of the game in progress. Losing a long board
      // to a crash is the worst bug this app can have, so it is written on
      // every move rather than only on backgrounding.
      `CREATE TABLE IF NOT EXISTS saved_game (
        id INTEGER PRIMARY KEY CHECK (id = 1),
        payload TEXT NOT NULL,
        updatedAt TEXT NOT NULL,
        deviceId TEXT NOT NULL
      )`,
    ],
  },
];

export const LATEST_SCHEMA_VERSION = MIGRATIONS.length;
