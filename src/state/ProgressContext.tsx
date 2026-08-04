/**
 * Points, streaks, stats and achievements.
 *
 * Everything here is derived from the games table rather than incremented in
 * place, so a number that looks wrong can be recomputed rather than only
 * patched. The one genuinely stateful thing is the streak-freeze balance,
 * because a spent freeze is not recoverable from history.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

import {
  listUnlockedAchievementIds,
  unlockAchievements,
} from '../data/achievementUnlocks';
import {
  hasCompletedDailyChallenge,
  insertGame,
  listRankedPlayDayKeys,
} from '../data/games';
import { buildProgressSnapshot, statsByDifficulty, type DifficultyStats } from '../data/stats';
import { dayKeyOf } from '../utils/dates';
import {
  DAYS_PER_EARNED_FREEZE,
  MAXIMUM_FREEZES,
  freezesEarnedForStreak,
  longestStreakDays,
  summariseStreak,
  type StreakSummary,
} from '../utils/streak';
import { newlyEarnedAchievementIds, type AchievementId } from '../utils/achievements';
import { type FinishedGameSummary } from './GameContext';

const FREEZE_STORAGE_KEY = 'sudoku.streakFreezes.v1';

const EMPTY_STREAK: StreakSummary = {
  currentStreakDays: 0,
  freezesSpent: 0,
  freezesRemaining: 0,
  isAtRiskToday: false,
};

interface ProgressContextValue {
  isLoading: boolean;
  streak: StreakSummary;
  longestStreak: number;
  totalPoints: number;
  statsPerDifficulty: DifficultyStats[];
  unlockedAchievementIds: AchievementId[];
  hasCompletedTodaysDaily: boolean;
  refresh: () => Promise<void>;
  /** Persists a finished game and returns any achievements it just unlocked. */
  recordFinishedGame: (summary: FinishedGameSummary) => Promise<AchievementId[]>;
}

const ProgressContext = createContext<ProgressContextValue | null>(null);

async function readAvailableFreezes(): Promise<number> {
  const stored = await AsyncStorage.getItem(FREEZE_STORAGE_KEY);
  const parsed = stored === null ? 0 : Number(stored);
  return Number.isFinite(parsed) ? Math.min(Math.max(0, parsed), MAXIMUM_FREEZES) : 0;
}

async function writeAvailableFreezes(count: number): Promise<void> {
  await AsyncStorage.setItem(
    FREEZE_STORAGE_KEY,
    `${Math.min(Math.max(0, count), MAXIMUM_FREEZES)}`,
  );
}

export function ProgressProvider({ children }: { children: ReactNode }) {
  const [isLoading, setIsLoading] = useState(true);
  const [streak, setStreak] = useState<StreakSummary>(EMPTY_STREAK);
  const [longestStreak, setLongestStreak] = useState(0);
  const [totalPoints, setTotalPoints] = useState(0);
  const [statsPerDifficulty, setStatsPerDifficulty] = useState<DifficultyStats[]>([]);
  const [unlockedAchievementIds, setUnlockedAchievementIds] = useState<AchievementId[]>([]);
  const [hasCompletedTodaysDaily, setHasCompletedTodaysDaily] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const todayDayKey = dayKeyOf(new Date());
      const [playDayKeys, availableFreezes, unlocked, perDifficulty, dailyDone] =
        await Promise.all([
          listRankedPlayDayKeys(),
          readAvailableFreezes(),
          listUnlockedAchievementIds(),
          statsByDifficulty(),
          hasCompletedDailyChallenge(todayDayKey),
        ]);

      const streakSummary = summariseStreak(playDayKeys, todayDayKey, availableFreezes);
      const snapshot = await buildProgressSnapshot(
        streakSummary.currentStreakDays,
        longestStreakDays(playDayKeys),
      );

      setStreak(streakSummary);
      setLongestStreak(snapshot.longestStreakDays);
      setTotalPoints(snapshot.totalPoints);
      setStatsPerDifficulty(perDifficulty);
      setUnlockedAchievementIds(unlocked);
      setHasCompletedTodaysDaily(dailyDone);
    } catch (error) {
      console.warn('Could not load progress', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    // Reading persisted progress out of SQLite on mount is the "subscribe to
    // an external system" case the rule exists to permit; every setState in
    // `refresh` happens after an await, never synchronously in this body. The
    // rule cannot see through the async boundary, so it is silenced here only.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void refresh();
  }, [refresh]);

  const recordFinishedGame = useCallback(
    async (summary: FinishedGameSummary): Promise<AchievementId[]> => {
      const { game, score, dayKey } = summary;

      await insertGame({
        playedAt: new Date().toISOString(),
        dayKey,
        difficulty: game.difficulty,
        mode: game.mode,
        completed: game.status === 'won',
        elapsedSeconds: game.elapsedSeconds,
        points: score.finalPoints,
        wrongEntryCount: game.wrongEntryCount,
        repeatedWrongEntryCount: game.repeatedWrongEntryCount,
        unjustifiedPlacementCount: game.unjustifiedPlacementCount,
        hintCount: game.hintCount,
        instantValidationEnabled: game.instantValidationEnabled,
        strikeLimitEnabled: game.strikeLimitEnabled,
        autoCandidatesUsed: game.autoCandidatesUsed,
        isDailyChallenge: game.isDailyChallenge,
        seed: game.seed,
      });

      const todayDayKey = dayKeyOf(new Date());
      const playDayKeys = await listRankedPlayDayKeys();
      const availableFreezes = await readAvailableFreezes();
      const streakSummary = summariseStreak(playDayKeys, todayDayKey, availableFreezes);

      // Freezes spent bridging a gap are gone; a streak that has just crossed
      // another full week earns one back, up to the cap.
      const earnedThisGame =
        streakSummary.currentStreakDays > 0 &&
        streakSummary.currentStreakDays % DAYS_PER_EARNED_FREEZE === 0
          ? 1
          : 0;
      await writeAvailableFreezes(
        Math.min(
          MAXIMUM_FREEZES,
          streakSummary.freezesRemaining + earnedThisGame,
        ),
      );

      const snapshot = await buildProgressSnapshot(
        streakSummary.currentStreakDays,
        longestStreakDays(playDayKeys),
      );
      const previouslyUnlocked = await listUnlockedAchievementIds();
      const newlyUnlocked = newlyEarnedAchievementIds(previouslyUnlocked, snapshot);
      await unlockAchievements(newlyUnlocked);

      await refresh();
      return newlyUnlocked;
    },
    [refresh],
  );

  const value = useMemo<ProgressContextValue>(
    () => ({
      isLoading,
      streak,
      longestStreak,
      totalPoints,
      statsPerDifficulty,
      unlockedAchievementIds,
      hasCompletedTodaysDaily,
      refresh,
      recordFinishedGame,
    }),
    [
      isLoading,
      streak,
      longestStreak,
      totalPoints,
      statsPerDifficulty,
      unlockedAchievementIds,
      hasCompletedTodaysDaily,
      refresh,
      recordFinishedGame,
    ],
  );

  return <ProgressContext.Provider value={value}>{children}</ProgressContext.Provider>;
}

export function useProgress(): ProgressContextValue {
  const value = useContext(ProgressContext);
  if (value === null) {
    throw new Error('useProgress must be used inside a ProgressProvider');
  }
  return value;
}

/** Freezes a streak of this length would have earned, for the settings copy. */
export function freezesForStreak(currentStreakDays: number): number {
  return freezesEarnedForStreak(currentStreakDays);
}
