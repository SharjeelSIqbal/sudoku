/**
 * On-device preferences.
 *
 * Defaults are deliberately forgiving: validation on, strike limit off, hints
 * available. The hard modes are one tap away in Settings, but nobody is
 * started in them.
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

/** Cell-first taps a cell then a digit; digit-first picks a digit and paints. */
export type InputMode = 'cell-first' | 'digit-first';

export interface Settings {
  /** Off is harder: the app stops flagging wrong entries as you make them. */
  instantValidation: boolean;
  /** On is harder: three wrong entries ends the run. */
  strikeLimit: boolean;
  inputMode: InputMode;
  /** Fills pencil marks automatically. Caps the score multiplier. */
  autoCandidates: boolean;
  /** Dims cells sharing a unit with the selection. */
  highlightPeers: boolean;
  /** Highlights every cell holding the selected digit. */
  highlightSameDigit: boolean;
  hapticsEnabled: boolean;
  /** Opt-in, once a day, and only when a streak is actually at risk. */
  streakReminderEnabled: boolean;
  /** Local hour, 0-23, for that reminder. */
  streakReminderHour: number;
}

export const DEFAULT_SETTINGS: Settings = {
  instantValidation: true,
  strikeLimit: false,
  inputMode: 'cell-first',
  autoCandidates: false,
  highlightPeers: true,
  highlightSameDigit: true,
  hapticsEnabled: true,
  streakReminderEnabled: false,
  streakReminderHour: 19,
};

const STORAGE_KEY = 'sudoku.settings.v1';

interface SettingsContextValue {
  settings: Settings;
  /** True until the stored settings have been read. */
  isLoading: boolean;
  updateSettings: (changes: Partial<Settings>) => void;
  resetSettings: () => void;
}

const SettingsContext = createContext<SettingsContextValue | null>(null);

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    void (async () => {
      try {
        const stored = await AsyncStorage.getItem(STORAGE_KEY);
        if (isMounted && stored !== null) {
          // Spread over the defaults so a settings key added in a later
          // release is present rather than undefined on an existing install.
          setSettings({ ...DEFAULT_SETTINGS, ...(JSON.parse(stored) as Partial<Settings>) });
        }
      } catch (error) {
        console.warn('Could not read stored settings, using defaults', error);
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    })();

    return () => {
      isMounted = false;
    };
  }, []);

  const persist = useCallback((next: Settings) => {
    void AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next)).catch((error) => {
      console.warn('Could not save settings', error);
    });
  }, []);

  const updateSettings = useCallback(
    (changes: Partial<Settings>) => {
      setSettings((prev) => {
        const next = { ...prev, ...changes };
        persist(next);
        return next;
      });
    },
    [persist],
  );

  const resetSettings = useCallback(() => {
    setSettings(DEFAULT_SETTINGS);
    persist(DEFAULT_SETTINGS);
  }, [persist]);

  const value = useMemo(
    () => ({ settings, isLoading, updateSettings, resetSettings }),
    [settings, isLoading, updateSettings, resetSettings],
  );

  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
}

export function useSettings(): SettingsContextValue {
  const value = useContext(SettingsContext);
  if (value === null) {
    throw new Error('useSettings must be used inside a SettingsProvider');
  }
  return value;
}
