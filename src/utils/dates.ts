/**
 * Calendar-day helpers.
 *
 * Days are handled as `YYYY-MM-DD` strings in UTC rather than as `Date`
 * objects. Streaks are the one place in the app where an off-by-one is
 * genuinely upsetting — losing a month-long streak to a daylight-saving
 * boundary is exactly the kind of thing this app must not do — and string
 * days in a fixed zone have no boundaries to get wrong.
 */

/** A calendar day as `YYYY-MM-DD`. */
export type DayKey = string;

const MILLISECONDS_PER_DAY = 24 * 60 * 60 * 1000;

export function dayKeyOf(date: Date): DayKey {
  const year = date.getUTCFullYear();
  const month = `${date.getUTCMonth() + 1}`.padStart(2, '0');
  const dayOfMonth = `${date.getUTCDate()}`.padStart(2, '0');
  return `${year}-${month}-${dayOfMonth}`;
}

export function dateOfDayKey(dayKey: DayKey): Date {
  const [year, month, dayOfMonth] = dayKey.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, dayOfMonth));
}

export function previousDayKey(dayKey: DayKey): DayKey {
  return dayKeyOf(new Date(dateOfDayKey(dayKey).getTime() - MILLISECONDS_PER_DAY));
}

export function nextDayKey(dayKey: DayKey): DayKey {
  return dayKeyOf(new Date(dateOfDayKey(dayKey).getTime() + MILLISECONDS_PER_DAY));
}

/** Whole days from the earlier key to the later one; negative if reversed. */
export function daysBetween(earlierDayKey: DayKey, laterDayKey: DayKey): number {
  return Math.round(
    (dateOfDayKey(laterDayKey).getTime() - dateOfDayKey(earlierDayKey).getTime()) /
      MILLISECONDS_PER_DAY,
  );
}

/** `4m 07s`, for timers and best-time displays. */
export function formatDuration(totalSeconds: number): string {
  const safeSeconds = Math.max(0, Math.floor(totalSeconds));
  const hours = Math.floor(safeSeconds / 3600);
  const minutes = Math.floor((safeSeconds % 3600) / 60);
  const seconds = safeSeconds % 60;

  if (hours > 0) {
    return `${hours}h ${`${minutes}`.padStart(2, '0')}m`;
  }
  return `${minutes}m ${`${seconds}`.padStart(2, '0')}s`;
}
