import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { DIFFICULTIES, type Difficulty, type PlayMode } from '../../../game/types';
import { loadGameSnapshot } from '../../../data/savedGame';
import { useAppNavigation } from '../../../navigation/types';
import { gameFromSnapshot, useGame } from '../../../state/GameContext';
import { useProgress } from '../../../state/ProgressContext';
import { useSettings } from '../../../state/SettingsContext';
import { usePuzzleLoader } from '../../../state/usePuzzleLoader';
import { useC } from '../../../theme/colors';
import {
  DIFFICULTY_BLURBS,
  DIFFICULTY_LABELS,
  PLAY_MODE_BLURBS,
  PLAY_MODE_LABELS,
  formatPoints,
} from '../../../utils/labels';
import { DAILY_CHALLENGE_DIFFICULTY, MINIMUM_TOUCH_TARGET } from './constants';

export function HomeScreen() {
  const colors = useC();
  const insets = useSafeAreaInsets();
  const navigation = useAppNavigation();
  const { settings } = useSettings();
  const { startGame, resumeGame } = useGame();
  const { streak, totalPoints, hasCompletedTodaysDaily } = useProgress();
  const { loadPuzzle, loadDailyPuzzle, isGenerating } = usePuzzleLoader();

  const [mode, setMode] = useState<PlayMode>('ranked');
  const [isStarting, setIsStarting] = useState(false);

  const beginGame = useCallback(
    async (difficulty: Difficulty, isDailyChallenge: boolean) => {
      setIsStarting(true);
      try {
        const puzzle = isDailyChallenge
          ? await loadDailyPuzzle(difficulty)
          : await loadPuzzle(difficulty);

        startGame({
          seed: puzzle.seed,
          difficulty: puzzle.difficulty,
          mode,
          isDailyChallenge,
          givens: puzzle.givens,
          solution: puzzle.solution,
          // Captured now, not read at scoring time — see GameContext.
          instantValidationEnabled: settings.instantValidation,
          strikeLimitEnabled: settings.strikeLimit,
          autoCandidatesEnabled: settings.autoCandidates,
        });
        navigation.navigate('Game');
      } catch (error) {
        console.warn('Could not start a game', error);
      } finally {
        setIsStarting(false);
      }
    },
    [loadDailyPuzzle, loadPuzzle, mode, navigation, settings, startGame],
  );

  const continueSavedGame = useCallback(async () => {
    const snapshot = await loadGameSnapshot();
    if (snapshot === null) {
      return;
    }
    resumeGame(gameFromSnapshot(snapshot));
    navigation.navigate('Game');
  }, [navigation, resumeGame]);

  const styles = createStyles();
  const isBusy = isStarting || isGenerating;

  return (
    <ScrollView
      style={{ backgroundColor: colors.background }}
      contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 32 }]}
    >
      <View style={[styles.summaryRow, { borderColor: colors.rule }]}>
        <SummaryTile label="Points" value={formatPoints(totalPoints)} />
        <SummaryTile
          label="Streak"
          value={`${streak.currentStreakDays}`}
          note={
            streak.isAtRiskToday
              ? 'Play today to keep it'
              : streak.freezesRemaining > 0
                ? `${streak.freezesRemaining} freeze${streak.freezesRemaining === 1 ? '' : 's'} in hand`
                : undefined
          }
        />
      </View>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Continue your saved game"
        onPress={continueSavedGame}
        style={({ pressed }) => [
          styles.secondaryButton,
          { borderColor: colors.rule, opacity: pressed ? 0.7 : 1 },
        ]}
      >
        <Text style={[styles.secondaryButtonText, { color: colors.foreground }]}>
          Continue saved game
        </Text>
      </Pressable>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel={
          hasCompletedTodaysDaily
            ? "Today's daily challenge, already completed"
            : "Play today's daily challenge"
        }
        disabled={isBusy}
        onPress={() => void beginGame(DAILY_CHALLENGE_DIFFICULTY, true)}
        style={({ pressed }) => [
          styles.dailyButton,
          { backgroundColor: colors.accent, opacity: pressed || isBusy ? 0.7 : 1 },
        ]}
      >
        <Text style={[styles.dailyTitle, { color: colors.accentForeground }]}>
          {hasCompletedTodaysDaily ? "Today's challenge — done" : "Today's challenge"}
        </Text>
        <Text style={[styles.dailySubtitle, { color: colors.accentForeground }]}>
          The same puzzle for everyone, every day.
        </Text>
      </Pressable>

      <Text style={[styles.sectionHeading, { color: colors.foregroundMuted }]}>Mode</Text>
      <View style={styles.modeRow}>
        {(['ranked', 'zen'] as const).map((candidateMode) => {
          const isSelected = candidateMode === mode;
          return (
            <Pressable
              key={candidateMode}
              accessibilityRole="radio"
              accessibilityState={{ selected: isSelected }}
              accessibilityLabel={`${PLAY_MODE_LABELS[candidateMode]}. ${PLAY_MODE_BLURBS[candidateMode]}`}
              onPress={() => setMode(candidateMode)}
              style={[
                styles.modeButton,
                {
                  backgroundColor: isSelected ? colors.surfaceRaised : colors.surface,
                  borderColor: isSelected ? colors.accent : colors.rule,
                },
              ]}
            >
              <Text style={[styles.modeTitle, { color: colors.foreground }]}>
                {PLAY_MODE_LABELS[candidateMode]}
              </Text>
              <Text style={[styles.modeBlurb, { color: colors.foregroundMuted }]}>
                {PLAY_MODE_BLURBS[candidateMode]}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <Text style={[styles.sectionHeading, { color: colors.foregroundMuted }]}>
        New puzzle
      </Text>
      {DIFFICULTIES.map((difficulty) => (
        <Pressable
          key={difficulty}
          accessibilityRole="button"
          accessibilityLabel={`Start a ${DIFFICULTY_LABELS[difficulty]} puzzle. ${DIFFICULTY_BLURBS[difficulty]}`}
          disabled={isBusy}
          onPress={() => void beginGame(difficulty, false)}
          style={({ pressed }) => [
            styles.difficultyButton,
            {
              backgroundColor: colors.surface,
              borderColor: colors.rule,
              opacity: pressed || isBusy ? 0.7 : 1,
            },
          ]}
        >
          <Text style={[styles.difficultyLabel, { color: colors.foreground }]}>
            {DIFFICULTY_LABELS[difficulty]}
          </Text>
          <Text style={[styles.difficultyBlurb, { color: colors.foregroundMuted }]}>
            {DIFFICULTY_BLURBS[difficulty]}
          </Text>
        </Pressable>
      ))}

      {isBusy ? (
        <View style={styles.busyRow}>
          <ActivityIndicator color={colors.accent} />
          <Text style={[styles.busyText, { color: colors.foregroundMuted }]}>
            Building a puzzle…
          </Text>
        </View>
      ) : null}

      <View style={styles.navRow}>
        {(['Stats', 'Achievements', 'Settings'] as const).map((routeName) => (
          <Pressable
            key={routeName}
            accessibilityRole="button"
            accessibilityLabel={routeName}
            onPress={() => navigation.navigate(routeName)}
            style={({ pressed }) => [
              styles.navButton,
              { borderColor: colors.rule, opacity: pressed ? 0.7 : 1 },
            ]}
          >
            <Text style={[styles.navButtonText, { color: colors.foreground }]}>
              {routeName}
            </Text>
          </Pressable>
        ))}
      </View>
    </ScrollView>
  );
}

function SummaryTile({
  label,
  value,
  note,
}: {
  label: string;
  value: string;
  note?: string;
}) {
  const colors = useC();
  const styles = createStyles();

  return (
    <View style={styles.summaryTile} accessibilityLabel={`${label}: ${value}`}>
      <Text style={[styles.summaryValue, { color: colors.foreground }]}>{value}</Text>
      <Text style={[styles.summaryLabel, { color: colors.foregroundMuted }]}>{label}</Text>
      {note ? (
        <Text style={[styles.summaryNote, { color: colors.foregroundMuted }]}>{note}</Text>
      ) : null}
    </View>
  );
}

function createStyles() {
  return StyleSheet.create({
    content: { padding: 16, gap: 12 },
    summaryRow: {
      flexDirection: 'row',
      borderWidth: StyleSheet.hairlineWidth,
      borderRadius: 12,
      overflow: 'hidden',
    },
    summaryTile: { flex: 1, padding: 16, alignItems: 'center', gap: 2 },
    summaryValue: { fontSize: 28, fontWeight: '700' },
    summaryLabel: { fontSize: 13 },
    summaryNote: { fontSize: 11, textAlign: 'center' },
    sectionHeading: {
      fontSize: 13,
      fontWeight: '600',
      textTransform: 'uppercase',
      letterSpacing: 0.6,
      marginTop: 8,
    },
    dailyButton: { borderRadius: 12, padding: 16, gap: 4, minHeight: MINIMUM_TOUCH_TARGET },
    dailyTitle: { fontSize: 18, fontWeight: '700' },
    dailySubtitle: { fontSize: 13 },
    modeRow: { flexDirection: 'row', gap: 12 },
    modeButton: {
      flex: 1,
      borderRadius: 12,
      borderWidth: 1.5,
      padding: 12,
      gap: 4,
      minHeight: MINIMUM_TOUCH_TARGET,
    },
    modeTitle: { fontSize: 16, fontWeight: '600' },
    modeBlurb: { fontSize: 12 },
    difficultyButton: {
      borderRadius: 12,
      borderWidth: StyleSheet.hairlineWidth,
      padding: 14,
      gap: 2,
      minHeight: MINIMUM_TOUCH_TARGET,
      justifyContent: 'center',
    },
    difficultyLabel: { fontSize: 17, fontWeight: '600' },
    difficultyBlurb: { fontSize: 12 },
    secondaryButton: {
      borderRadius: 12,
      borderWidth: StyleSheet.hairlineWidth,
      padding: 14,
      alignItems: 'center',
      minHeight: MINIMUM_TOUCH_TARGET,
      justifyContent: 'center',
    },
    secondaryButtonText: { fontSize: 15, fontWeight: '600' },
    busyRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 8 },
    busyText: { fontSize: 13 },
    navRow: { flexDirection: 'row', gap: 8, marginTop: 8 },
    navButton: {
      flex: 1,
      borderRadius: 10,
      borderWidth: StyleSheet.hairlineWidth,
      paddingVertical: 12,
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: MINIMUM_TOUCH_TARGET,
    },
    navButtonText: { fontSize: 14, fontWeight: '600' },
  });
}
