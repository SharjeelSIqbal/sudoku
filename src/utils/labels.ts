/**
 * Display strings shared by more than one screen.
 *
 * A label used in one place belongs in that feature's `constants.ts`; these
 * are here because home, game and stats must all call a tier the same thing.
 */

import { type Difficulty, type PlayMode } from '../game/types';

export const DIFFICULTY_LABELS: Record<Difficulty, string> = {
  easy: 'Easy',
  medium: 'Medium',
  hard: 'Hard',
  expert: 'Expert',
  extreme: 'Extreme',
  master: 'Master',
};

/** One line describing what a tier will ask of the player. */
export const DIFFICULTY_BLURBS: Record<Difficulty, string> = {
  easy: 'Scanning only — no eliminations needed.',
  medium: 'Locked candidates and naked pairs.',
  hard: 'Hidden pairs, triples and quads.',
  expert: 'X-Wings, colouring and XY-Wings.',
  extreme: 'Swordfish, bigger wings and unique rectangles.',
  master: 'Needs at least one forcing chain.',
};

export const PLAY_MODE_LABELS: Record<PlayMode, string> = {
  ranked: 'Ranked',
  zen: 'Zen',
};

export const PLAY_MODE_BLURBS: Record<PlayMode, string> = {
  ranked: 'Timed and scored. Counts toward streaks and awards.',
  zen: 'No timer, no score, no mistake limit. Just the puzzle.',
};

export function formatPoints(points: number): string {
  return points.toLocaleString('en-GB');
}
