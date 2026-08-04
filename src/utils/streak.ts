/**
 * Streaks, with forgiveness.
 *
 * A plain "days since your last gap" streak punishes one busy day by wiping
 * weeks of progress, which is stressful rather than motivating — and this app
 * is built for someone who should enjoy it. So a streak can spend a *freeze*
 * to bridge a missed day. Freezes are earned slowly by playing and capped, so
 * they forgive an off day without making the streak meaningless.
 *
 * That is why the streak is a walk over play history rather than a stored
 * counter: the answer depends on which gaps freezes covered, and a counter
 * cannot be recomputed or corrected after the fact.
 */

import { nextDayKey, previousDayKey, type DayKey } from './dates';

/** One freeze is earned for every this many consecutive days played. */
export const DAYS_PER_EARNED_FREEZE = 7;

/** Freezes never stack past this, so a long absence still ends a streak. */
export const MAXIMUM_FREEZES = 3;

/** How far back the walk will go before giving up. Roughly seven years. */
const MAXIMUM_DAYS_WALKED = 2600;

export interface StreakSummary {
  /** Consecutive days played, counting any bridged by a freeze. */
  currentStreakDays: number;
  /** Freezes consumed to reach that number. */
  freezesSpent: number;
  /** Freezes still in hand afterwards. */
  freezesRemaining: number;
  /** True when today has not been played but the streak is still alive. */
  isAtRiskToday: boolean;
}

/**
 * Walks back from today over the days that were played.
 *
 * `playedDayKeys` should be the days with a completed *ranked* game — zen
 * games deliberately do not advance a streak.
 */
export function summariseStreak(
  playedDayKeys: Iterable<DayKey>,
  todayDayKey: DayKey,
  availableFreezes: number,
): StreakSummary {
  const playedDays = new Set(playedDayKeys);
  const playedToday = playedDays.has(todayDayKey);

  let freezesRemaining = Math.max(0, Math.min(availableFreezes, MAXIMUM_FREEZES));
  let freezesSpent = 0;
  let currentStreakDays = 0;

  // A streak is still alive on a day you have not played yet, so when today is
  // unplayed the walk starts at yesterday rather than ending the streak.
  let dayUnderTest = playedToday ? todayDayKey : previousDayKey(todayDayKey);

  for (let daysWalked = 0; daysWalked < MAXIMUM_DAYS_WALKED; daysWalked += 1) {
    if (playedDays.has(dayUnderTest)) {
      currentStreakDays += 1;
      dayUnderTest = previousDayKey(dayUnderTest);
      continue;
    }

    if (freezesRemaining > 0) {
      freezesRemaining -= 1;
      freezesSpent += 1;
      dayUnderTest = previousDayKey(dayUnderTest);
      continue;
    }

    break;
  }

  return {
    currentStreakDays,
    freezesSpent,
    freezesRemaining,
    isAtRiskToday: !playedToday && currentStreakDays > 0,
  };
}

/** The longest run ever achieved, ignoring freezes — a pure historical best. */
export function longestStreakDays(playedDayKeys: Iterable<DayKey>): number {
  const playedDays = new Set(playedDayKeys);
  let longest = 0;

  for (const dayKey of playedDays) {
    // Only start counting from the first day of a run, so each run is walked
    // once rather than once per day it contains.
    if (playedDays.has(previousDayKey(dayKey))) {
      continue;
    }

    let runLength = 0;
    let dayUnderTest = dayKey;
    while (playedDays.has(dayUnderTest)) {
      runLength += 1;
      dayUnderTest = nextDayKey(dayUnderTest);
    }
    longest = Math.max(longest, runLength);
  }

  return longest;
}

/**
 * Freezes earned by a streak of a given length, capped. Called when a game
 * completes so the balance is recomputed rather than incremented — an
 * incremented counter drifts, and this one is user-visible.
 */
export function freezesEarnedForStreak(currentStreakDays: number): number {
  return Math.min(
    MAXIMUM_FREEZES,
    Math.floor(currentStreakDays / DAYS_PER_EARNED_FREEZE),
  );
}
