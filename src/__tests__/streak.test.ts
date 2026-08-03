import {
  dayKeyOf,
  daysBetween,
  formatDuration,
  nextDayKey,
  previousDayKey,
} from '../utils/dates';
import {
  MAXIMUM_FREEZES,
  freezesEarnedForStreak,
  longestStreakDays,
  summariseStreak,
} from '../utils/streak';

/** Builds `count` consecutive day keys ending on `lastDayKey`. */
function consecutiveDaysEndingOn(lastDayKey: string, count: number): string[] {
  const days: string[] = [];
  let dayKey = lastDayKey;
  for (let index = 0; index < count; index += 1) {
    days.push(dayKey);
    dayKey = previousDayKey(dayKey);
  }
  return days;
}

describe('day keys', () => {
  it('formats a date as YYYY-MM-DD in UTC', () => {
    expect(dayKeyOf(new Date(Date.UTC(2026, 7, 3)))).toBe('2026-08-03');
  });

  it('steps across a month boundary', () => {
    expect(previousDayKey('2026-08-01')).toBe('2026-07-31');
    expect(nextDayKey('2026-07-31')).toBe('2026-08-01');
  });

  it('steps across a year boundary', () => {
    expect(previousDayKey('2027-01-01')).toBe('2026-12-31');
    expect(nextDayKey('2026-12-31')).toBe('2027-01-01');
  });

  it('handles a leap day', () => {
    expect(nextDayKey('2028-02-28')).toBe('2028-02-29');
    expect(nextDayKey('2028-02-29')).toBe('2028-03-01');
  });

  it('counts whole days between keys', () => {
    expect(daysBetween('2026-08-01', '2026-08-04')).toBe(3);
    expect(daysBetween('2026-08-04', '2026-08-01')).toBe(-3);
    expect(daysBetween('2026-08-01', '2026-08-01')).toBe(0);
  });

  it('is unaffected by the time of day, so streaks survive daylight saving', () => {
    const earlyUtc = dayKeyOf(new Date(Date.UTC(2026, 2, 29, 0, 30)));
    const lateUtc = dayKeyOf(new Date(Date.UTC(2026, 2, 29, 23, 30)));
    expect(earlyUtc).toBe(lateUtc);
  });
});

describe('duration formatting', () => {
  it('shows minutes and padded seconds', () => {
    expect(formatDuration(65)).toBe('1m 05s');
    expect(formatDuration(0)).toBe('0m 00s');
  });

  it('switches to hours for long games', () => {
    expect(formatDuration(3 * 3600 + 4 * 60)).toBe('3h 04m');
  });

  it('does not produce negative times', () => {
    expect(formatDuration(-10)).toBe('0m 00s');
  });
});

describe('streak counting', () => {
  const today = '2026-08-03';

  it('counts an unbroken run ending today', () => {
    const played = consecutiveDaysEndingOn(today, 5);
    expect(summariseStreak(played, today, 0).currentStreakDays).toBe(5);
  });

  it('is zero when nothing has been played', () => {
    expect(summariseStreak([], today, 0).currentStreakDays).toBe(0);
  });

  it('keeps a streak alive on a day not yet played', () => {
    // Yesterday counts; today is still ahead of the player, not a miss.
    const played = consecutiveDaysEndingOn(previousDayKey(today), 4);
    const summary = summariseStreak(played, today, 0);

    expect(summary.currentStreakDays).toBe(4);
    expect(summary.isAtRiskToday).toBe(true);
  });

  it('reports no risk once today has been played', () => {
    const played = consecutiveDaysEndingOn(today, 2);
    expect(summariseStreak(played, today, 0).isAtRiskToday).toBe(false);
  });

  it('ends a streak at a gap when no freeze is held', () => {
    const played = [today, previousDayKey(previousDayKey(today))];
    expect(summariseStreak(played, today, 0).currentStreakDays).toBe(1);
  });

  it('spends a freeze to bridge one missed day', () => {
    // The whole point: one busy day must not wipe weeks of progress.
    const missedDay = previousDayKey(today);
    const before = consecutiveDaysEndingOn(previousDayKey(missedDay), 9);
    const played = [today, ...before];

    const summary = summariseStreak(played, today, 1);
    expect(summary.currentStreakDays).toBe(10);
    expect(summary.freezesSpent).toBe(1);
    expect(summary.freezesRemaining).toBe(0);
  });

  it('still ends the streak once the freezes run out', () => {
    const played = [today];
    // Two consecutive missed days, only one freeze in hand.
    const older = previousDayKey(previousDayKey(previousDayKey(today)));
    played.push(older);

    const summary = summariseStreak(played, today, 1);
    expect(summary.currentStreakDays).toBe(1);
  });

  it('never spends more freezes than the cap allows', () => {
    const summary = summariseStreak([today], today, 999);
    expect(summary.freezesRemaining).toBeLessThanOrEqual(MAXIMUM_FREEZES);
  });

  it('ignores duplicate play days', () => {
    const played = [today, today, previousDayKey(today)];
    expect(summariseStreak(played, today, 0).currentStreakDays).toBe(2);
  });
});

describe('earned freezes', () => {
  it('earns none before the first full week', () => {
    expect(freezesEarnedForStreak(0)).toBe(0);
    expect(freezesEarnedForStreak(6)).toBe(0);
  });

  it('earns one a week', () => {
    expect(freezesEarnedForStreak(7)).toBe(1);
    expect(freezesEarnedForStreak(14)).toBe(2);
  });

  it('is capped, so a long absence still ends a streak', () => {
    expect(freezesEarnedForStreak(1000)).toBe(MAXIMUM_FREEZES);
  });
});

describe('longest streak', () => {
  it('finds the best historical run, ignoring freezes', () => {
    const shortRun = consecutiveDaysEndingOn('2026-01-05', 3);
    const longRun = consecutiveDaysEndingOn('2026-03-20', 11);
    expect(longestStreakDays([...shortRun, ...longRun])).toBe(11);
  });

  it('is zero with no history', () => {
    expect(longestStreakDays([])).toBe(0);
  });

  it('counts a single day as a run of one', () => {
    expect(longestStreakDays(['2026-08-03'])).toBe(1);
  });
});
