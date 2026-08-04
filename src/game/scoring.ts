/**
 * The points model. Every tunable number lives here and nowhere else — a
 * magic number in a screen is how a scoring system quietly stops matching what
 * the stats page claims.
 *
 *     score = max(0, (base - penalties) * multipliers)
 */

import { type Difficulty, type PlayMode } from './types';

/**
 * Base points per tier. The curve is steep on purpose: a solved Master is
 * worth twenty-five Easies, so grinding the bottom of the ladder is never the
 * efficient way to earn points.
 */
export const BASE_POINTS: Record<Difficulty, number> = {
  easy: 100,
  medium: 250,
  hard: 500,
  expert: 900,
  extreme: 1500,
  master: 2500,
};

/** The time a solve is measured against for the speed multiplier, in seconds. */
export const PAR_SECONDS: Record<Difficulty, number> = {
  easy: 300,
  medium: 600,
  hard: 900,
  expert: 1500,
  extreme: 2400,
  master: 3600,
};

/**
 * Penalties, as a fraction of the tier's base points, so that a mistake costs
 * proportionally the same wherever it happens.
 */
export const PENALTY_FRACTIONS = {
  /** A digit that was simply wrong. */
  wrongEntry: 0.04,
  /**
   * Added on top of `wrongEntry` for each repeat in the same cell. Cycling a
   * cell through 1-9 should be strictly worse than thinking.
   */
  repeatedWrongEntry: 0.03,
  /** Correct, but not yet deducible — a lucky guess. Small but real. */
  unjustifiedPlacement: 0.01,
  /** The largest single penalty: the app did the reasoning. */
  hintUsed: 0.08,
} as const;

export const SPEED_MULTIPLIER_MAXIMUM = 1.5;
export const SPEED_MULTIPLIER_MINIMUM = 1.0;
/** At or under half par earns the full speed bonus. */
export const SPEED_RATIO_FOR_MAXIMUM = 0.5;
/** At or over twice par earns none of it. */
export const SPEED_RATIO_FOR_MINIMUM = 2.0;

export const BONUS_MULTIPLIERS = {
  /** No wrong entries all game. */
  flawless: 1.25,
  /** No hints all game. */
  noHints: 1.2,
  /** Played with instant validation switched off. */
  validationOff: 1.3,
  /** Played with the three-mistake limit switched on. */
  strikeLimitOn: 1.15,
} as const;

/** Each consecutive day adds this much, up to the cap. */
export const STREAK_MULTIPLIER_PER_DAY = 0.02;
export const STREAK_MULTIPLIER_MAXIMUM = 1.5;

/**
 * Auto-candidates does most of the bookkeeping a solver would otherwise do by
 * hand, so it caps the total multiplier rather than adding a penalty — the
 * game stays fully playable, it just stops being a scoring contest.
 */
export const AUTO_CANDIDATES_MULTIPLIER_CEILING = 1.1;

export interface ScoreInput {
  difficulty: Difficulty;
  mode: PlayMode;
  /** True only when the grid was completed correctly. */
  completed: boolean;
  elapsedSeconds: number;
  /** Distinct wrong digits entered. */
  wrongEntryCount: number;
  /** Wrong entries beyond the first in a cell the player had already got wrong. */
  repeatedWrongEntryCount: number;
  /** Correct placements the engine judged as guesses. */
  unjustifiedPlacementCount: number;
  hintCount: number;
  instantValidationEnabled: boolean;
  strikeLimitEnabled: boolean;
  autoCandidatesUsed: boolean;
  /** Consecutive days played, before this game is counted. */
  currentStreakDays: number;
}

export interface ScoreBreakdown {
  basePoints: number;
  penaltyPoints: number;
  speedMultiplier: number;
  bonusMultiplier: number;
  streakMultiplier: number;
  /** The product actually applied, after any auto-candidates ceiling. */
  totalMultiplier: number;
  finalPoints: number;
}

function clamp(value: number, lowest: number, highest: number): number {
  return Math.min(highest, Math.max(lowest, value));
}

/**
 * Full bonus at or under half par, none at or over twice par, straight line
 * between. Deliberately gentle — this is a game for enjoying, and a punishing
 * clock would push players away from the harder tiers.
 */
export function speedMultiplierFor(
  difficulty: Difficulty,
  elapsedSeconds: number,
): number {
  const parSeconds = PAR_SECONDS[difficulty];
  const ratio = elapsedSeconds / parSeconds;

  if (ratio <= SPEED_RATIO_FOR_MAXIMUM) {
    return SPEED_MULTIPLIER_MAXIMUM;
  }
  if (ratio >= SPEED_RATIO_FOR_MINIMUM) {
    return SPEED_MULTIPLIER_MINIMUM;
  }

  const positionInRange =
    (ratio - SPEED_RATIO_FOR_MAXIMUM) /
    (SPEED_RATIO_FOR_MINIMUM - SPEED_RATIO_FOR_MAXIMUM);
  return (
    SPEED_MULTIPLIER_MAXIMUM -
    positionInRange * (SPEED_MULTIPLIER_MAXIMUM - SPEED_MULTIPLIER_MINIMUM)
  );
}

export function streakMultiplierFor(currentStreakDays: number): number {
  return clamp(
    1 + currentStreakDays * STREAK_MULTIPLIER_PER_DAY,
    1,
    STREAK_MULTIPLIER_MAXIMUM,
  );
}

export function penaltyPointsFor(input: ScoreInput): number {
  const base = BASE_POINTS[input.difficulty];
  return Math.round(
    base *
      (input.wrongEntryCount * PENALTY_FRACTIONS.wrongEntry +
        input.repeatedWrongEntryCount * PENALTY_FRACTIONS.repeatedWrongEntry +
        input.unjustifiedPlacementCount * PENALTY_FRACTIONS.unjustifiedPlacement +
        input.hintCount * PENALTY_FRACTIONS.hintUsed),
  );
}

const ZERO_SCORE: ScoreBreakdown = {
  basePoints: 0,
  penaltyPoints: 0,
  speedMultiplier: 1,
  bonusMultiplier: 1,
  streakMultiplier: 1,
  totalMultiplier: 1,
  finalPoints: 0,
};

export function computeScore(input: ScoreInput): ScoreBreakdown {
  // Zen is unscored by design, and an abandoned game earns nothing.
  if (input.mode === 'zen' || !input.completed) {
    return { ...ZERO_SCORE };
  }

  const basePoints = BASE_POINTS[input.difficulty];
  const penaltyPoints = penaltyPointsFor(input);
  const speedMultiplier = speedMultiplierFor(input.difficulty, input.elapsedSeconds);
  const streakMultiplier = streakMultiplierFor(input.currentStreakDays);

  let bonusMultiplier = 1;
  if (input.wrongEntryCount === 0) {
    bonusMultiplier *= BONUS_MULTIPLIERS.flawless;
  }
  if (input.hintCount === 0) {
    bonusMultiplier *= BONUS_MULTIPLIERS.noHints;
  }
  if (!input.instantValidationEnabled) {
    bonusMultiplier *= BONUS_MULTIPLIERS.validationOff;
  }
  if (input.strikeLimitEnabled) {
    bonusMultiplier *= BONUS_MULTIPLIERS.strikeLimitOn;
  }

  const uncappedMultiplier = speedMultiplier * bonusMultiplier * streakMultiplier;
  const totalMultiplier = input.autoCandidatesUsed
    ? Math.min(uncappedMultiplier, AUTO_CANDIDATES_MULTIPLIER_CEILING)
    : uncappedMultiplier;

  const finalPoints = Math.max(
    0,
    Math.round((basePoints - penaltyPoints) * totalMultiplier),
  );

  return {
    basePoints,
    penaltyPoints,
    speedMultiplier,
    bonusMultiplier,
    streakMultiplier,
    totalMultiplier,
    finalPoints,
  };
}
