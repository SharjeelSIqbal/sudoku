import { type Difficulty } from '../../../game/types';

/**
 * The tier the daily challenge is generated at.
 *
 * Fixed rather than following the player's last choice, because the point of
 * the daily is that everyone gets the same grid. Medium is chosen so it stays
 * approachable — a daily that is regularly too hard just stops being played.
 */
export const DAILY_CHALLENGE_DIFFICULTY: Difficulty = 'medium';

/** Apple's minimum comfortable touch target, in points. */
export const MINIMUM_TOUCH_TARGET = 44;
