/**
 * The pre-generated puzzle bank.
 *
 * Generation costs many solver runs and Master can take seconds, so it must
 * never happen inside `onPress`. Starting a game pops a row from here — one
 * indexed query — and the bank tops itself back up afterwards, off the
 * interaction path. That is the whole reason this table exists.
 */

import { generatePuzzle, type GeneratedPuzzle } from '../game/generator';
import { CELL_COUNT, EMPTY_CELL, type Difficulty } from '../game/types';
import { deviceId, getDatabase, newRecordId, nowIsoString } from './db';

/** How many puzzles per tier the bank tries to keep in hand. */
export const TARGET_BANK_SIZE_PER_DIFFICULTY = 3;

/** Generated per top-up pass, so a refill never blocks for long. */
export const MAX_PUZZLES_PER_TOP_UP = 2;

export interface BankedPuzzle {
  id: string;
  difficulty: Difficulty;
  seed: string;
  givens: Uint8Array;
  solution: Uint8Array;
  clueCount: number;
}

interface PuzzleBankRow {
  id: string;
  difficulty: string;
  seed: string;
  givens: string;
  solution: string;
  clueCount: number;
}

function digitsToText(digits: Uint8Array): string {
  return [...digits].map((digit) => (digit === EMPTY_CELL ? '.' : `${digit}`)).join('');
}

function textToDigits(text: string): Uint8Array {
  const digits = new Uint8Array(CELL_COUNT);
  for (let cellIndex = 0; cellIndex < CELL_COUNT; cellIndex += 1) {
    const character = text[cellIndex];
    digits[cellIndex] = character === '.' ? EMPTY_CELL : Number(character);
  }
  return digits;
}

export function rowToBankedPuzzle(row: PuzzleBankRow): BankedPuzzle {
  return {
    id: row.id,
    difficulty: row.difficulty as Difficulty,
    seed: row.seed,
    givens: textToDigits(row.givens),
    solution: textToDigits(row.solution),
    clueCount: row.clueCount,
  };
}

export async function countBankedPuzzles(difficulty: Difficulty): Promise<number> {
  const database = await getDatabase();
  const row = await database.getFirstAsync<{ total: number }>(
    'SELECT COUNT(*) AS total FROM puzzle_bank WHERE difficulty = ?',
    [difficulty],
  );
  return row?.total ?? 0;
}

export async function storePuzzle(puzzle: GeneratedPuzzle): Promise<void> {
  const database = await getDatabase();
  const timestamp = nowIsoString();

  await database.runAsync(
    `INSERT INTO puzzle_bank
       (id, difficulty, seed, givens, solution, clueCount, createdAt, updatedAt, deviceId)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      newRecordId(),
      puzzle.difficulty,
      puzzle.seed,
      digitsToText(puzzle.givens),
      [...puzzle.solution].join(''),
      puzzle.clueCount,
      timestamp,
      timestamp,
      deviceId(),
    ],
  );
}

/**
 * Removes and returns a banked puzzle, or null when the bank is dry.
 *
 * Null is a real answer, not a failure: the caller shows an honest generating
 * state rather than freezing on the tap.
 */
export async function takeBankedPuzzle(
  difficulty: Difficulty,
): Promise<BankedPuzzle | null> {
  const database = await getDatabase();
  const row = await database.getFirstAsync<PuzzleBankRow>(
    'SELECT * FROM puzzle_bank WHERE difficulty = ? ORDER BY createdAt LIMIT 1',
    [difficulty],
  );

  if (!row) {
    return null;
  }

  await database.runAsync('DELETE FROM puzzle_bank WHERE id = ?', [row.id]);
  return rowToBankedPuzzle(row);
}

/**
 * Generates puzzles for whichever tier is shortest, up to a small cap.
 *
 * Capped rather than filling everything at once so a top-up is a short burst
 * of work that can be scheduled after interactions, not a long one that janks
 * whatever the player is doing.
 */
export async function topUpBank(
  difficulties: readonly Difficulty[],
  seedPrefix: string,
): Promise<number> {
  let generatedCount = 0;

  for (const difficulty of difficulties) {
    if (generatedCount >= MAX_PUZZLES_PER_TOP_UP) {
      break;
    }

    const banked = await countBankedPuzzles(difficulty);
    for (
      let index = banked;
      index < TARGET_BANK_SIZE_PER_DIFFICULTY && generatedCount < MAX_PUZZLES_PER_TOP_UP;
      index += 1
    ) {
      const puzzle = generatePuzzle(
        `${seedPrefix}-${difficulty}-${index}-${nowIsoString()}`,
        difficulty,
      );
      await storePuzzle(puzzle);
      generatedCount += 1;
    }
  }

  return generatedCount;
}
