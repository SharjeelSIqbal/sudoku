import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { EMPTY_CELL, type Digit } from '../../../game/types';
import { useAppNavigation } from '../../../navigation/types';
import { MAX_STRIKES, useGame } from '../../../state/GameContext';
import { useProgress } from '../../../state/ProgressContext';
import { useSettings } from '../../../state/SettingsContext';
import { useC } from '../../../theme/colors';
import { formatDuration } from '../../../utils/dates';
import { DIFFICULTY_LABELS, formatPoints } from '../../../utils/labels';
import { MINIMUM_TOUCH_TARGET } from '../home/constants';
import { NumberPad } from './components/NumberPad';
import { SudokuBoard } from './components/SudokuBoard';

/** Leaves room for the pad and header without the board touching the bezels. */
const BOARD_HORIZONTAL_PADDING = 12;
const MAX_BOARD_SIZE = 480;

export function GameScreen() {
  const colors = useC();
  const insets = useSafeAreaInsets();
  const navigation = useAppNavigation();
  const { width, height } = useWindowDimensions();
  const { settings } = useSettings();
  const { streak, recordFinishedGame } = useProgress();
  const {
    game,
    selectCell,
    selectDigit,
    setPencilMode,
    enterDigit,
    togglePencilMark,
    eraseCell,
    undo,
    requestHint,
    applyHint,
    clearGame,
    summariseFinishedGame,
    remainingStrikes,
  } = useGame();

  const hasRecordedResult = useRef(false);
  const [earnedPoints, setEarnedPoints] = useState<number | null>(null);

  // Record the finished game exactly once, however many times this re-renders.
  useEffect(() => {
    if (game === null || game.status === 'playing' || hasRecordedResult.current) {
      return;
    }
    hasRecordedResult.current = true;

    // Scored against the streak as it stood *before* this game was recorded.
    // Recording advances the streak, so computing it afterwards would pay the
    // player a multiplier they had not yet earned when they finished.
    const summary = summariseFinishedGame(streak.currentStreakDays);
    if (summary === null) {
      return;
    }

    void recordFinishedGame(summary).then((newlyUnlocked) => {
      // Shown once it is actually persisted, so the number on screen is never
      // one the history disagrees with.
      setEarnedPoints(summary.score.finalPoints);
      if (newlyUnlocked.length > 0 && settings.hapticsEnabled) {
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
    });
  }, [game, recordFinishedGame, settings.hapticsEnabled, streak.currentStreakDays, summariseFinishedGame]);

  const handleCellPress = useCallback(
    (cellIndex: number) => {
      if (game === null) {
        return;
      }
      // Digit-first paints the chosen digit straight into the tapped cell;
      // cell-first just moves the selection and waits for a digit.
      if (settings.inputMode === 'digit-first' && game.selectedDigit !== null) {
        if (game.givens[cellIndex] === EMPTY_CELL) {
          if (game.isPencilMode) {
            togglePencilMark(cellIndex, game.selectedDigit);
          } else {
            enterDigit(cellIndex, game.selectedDigit);
          }
          return;
        }
      }
      selectCell(cellIndex);
    },
    [enterDigit, game, selectCell, settings.inputMode, togglePencilMark],
  );

  const handleDigitPress = useCallback(
    (digit: Digit) => {
      if (game === null) {
        return;
      }

      if (settings.inputMode === 'digit-first') {
        selectDigit(game.selectedDigit === digit ? null : digit);
        return;
      }

      const cellIndex = game.selectedCellIndex;
      if (cellIndex === null || game.givens[cellIndex] !== EMPTY_CELL) {
        return;
      }

      if (game.isPencilMode) {
        togglePencilMark(cellIndex, digit);
        return;
      }

      const isWrong = game.solution[cellIndex] !== digit;
      enterDigit(cellIndex, digit);

      // Haptics only when validation is on — a buzz on a wrong entry would
      // leak exactly what hard mode is meant to withhold.
      if (settings.hapticsEnabled && game.instantValidationEnabled && isWrong) {
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      }
    },
    [enterDigit, game, selectDigit, settings.hapticsEnabled, settings.inputMode, togglePencilMark],
  );

  const confirmQuit = useCallback(() => {
    Alert.alert('Leave this puzzle?', 'Your progress is saved, so you can pick it up later.', [
      { text: 'Keep playing', style: 'cancel' },
      {
        text: 'Leave',
        style: 'destructive',
        onPress: () => navigation.navigate('Home'),
      },
    ]);
  }, [navigation]);

  const styles = createStyles();

  if (game === null) {
    return (
      <View style={[styles.emptyState, { backgroundColor: colors.background }]}>
        <Text style={[styles.emptyText, { color: colors.foregroundMuted }]}>
          No puzzle in play.
        </Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Back to home"
          onPress={() => navigation.navigate('Home')}
          style={[styles.primaryButton, { backgroundColor: colors.accent }]}
        >
          <Text style={[styles.primaryButtonText, { color: colors.accentForeground }]}>
            Back
          </Text>
        </Pressable>
      </View>
    );
  }

  const boardSize = Math.min(
    width - BOARD_HORIZONTAL_PADDING * 2,
    height * 0.5,
    MAX_BOARD_SIZE,
  );
  const isFinished = game.status !== 'playing';

  return (
    <ScrollView
      style={{ backgroundColor: colors.background }}
      contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 24 }]}
    >
      <View style={styles.header}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Leave this puzzle"
          onPress={confirmQuit}
          style={styles.headerButton}
        >
          <Text style={[styles.headerButtonText, { color: colors.accent }]}>Leave</Text>
        </Pressable>

        <View style={styles.headerCenter}>
          <Text style={[styles.difficultyText, { color: colors.foreground }]}>
            {DIFFICULTY_LABELS[game.difficulty]}
            {game.isDailyChallenge ? ' · Daily' : ''}
          </Text>
          {game.mode === 'ranked' ? (
            <Text
              accessibilityLabel={`Elapsed time ${formatDuration(game.elapsedSeconds)}`}
              style={[styles.timerText, { color: colors.foregroundMuted }]}
            >
              {formatDuration(game.elapsedSeconds)}
            </Text>
          ) : (
            <Text style={[styles.timerText, { color: colors.foregroundMuted }]}>Zen</Text>
          )}
        </View>

        <View style={styles.headerButton}>
          {remainingStrikes !== null ? (
            <Text
              accessibilityLabel={`${remainingStrikes} of ${MAX_STRIKES} mistakes remaining`}
              style={[styles.strikesText, { color: colors.warning }]}
            >
              {remainingStrikes}/{MAX_STRIKES}
            </Text>
          ) : null}
        </View>
      </View>

      <View style={styles.boardWrapper}>
        <SudokuBoard
          game={game}
          boardSize={boardSize}
          highlightPeers={settings.highlightPeers}
          highlightSameDigit={settings.highlightSameDigit}
          onSelectCell={handleCellPress}
        />
      </View>

      {game.activeHint !== null ? (
        <View
          accessibilityRole="alert"
          style={[styles.hintCard, { backgroundColor: colors.surfaceRaised, borderColor: colors.rule }]}
        >
          <Text style={[styles.hintText, { color: colors.foreground }]}>
            {game.activeHint.explanation}
          </Text>
          {game.activeHint.placements.length > 0 ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Fill in the hinted cell"
              onPress={applyHint}
              style={[styles.hintApplyButton, { borderColor: colors.accent }]}
            >
              <Text style={[styles.hintApplyText, { color: colors.accent }]}>
                Fill it in
              </Text>
            </Pressable>
          ) : null}
        </View>
      ) : null}

      {isFinished ? (
        <View
          accessibilityRole="alert"
          style={[styles.resultCard, { backgroundColor: colors.surface, borderColor: colors.rule }]}
        >
          <Text style={[styles.resultTitle, { color: colors.foreground }]}>
            {game.status === 'won' ? 'Solved' : 'Out of mistakes'}
          </Text>
          {game.status === 'won' ? (
            <Text style={[styles.resultDetail, { color: colors.foregroundMuted }]}>
              {game.mode === 'zen'
                ? 'Nicely done.'
                : `${formatDuration(game.elapsedSeconds)} · ${formatPoints(earnedPoints ?? 0)} points`}
            </Text>
          ) : (
            <Text style={[styles.resultDetail, { color: colors.foregroundMuted }]}>
              Three mistakes ends a run with the strike limit on.
            </Text>
          )}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Back to home"
            onPress={() => {
              clearGame();
              navigation.navigate('Home');
            }}
            style={[styles.primaryButton, { backgroundColor: colors.accent }]}
          >
            <Text style={[styles.primaryButtonText, { color: colors.accentForeground }]}>
              Done
            </Text>
          </Pressable>
        </View>
      ) : (
        <NumberPad
          game={game}
          inputMode={settings.inputMode}
          onPressDigit={handleDigitPress}
          onErase={() =>
            game.selectedCellIndex !== null ? eraseCell(game.selectedCellIndex) : undefined
          }
          onUndo={undo}
          onTogglePencilMode={() => setPencilMode(!game.isPencilMode)}
          onHint={requestHint}
          canUndo={game.undoStack.length > 0}
        />
      )}
    </ScrollView>
  );
}

function createStyles() {
  return StyleSheet.create({
    content: { padding: BOARD_HORIZONTAL_PADDING, gap: 16 },
    header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    headerButton: { minWidth: 64, minHeight: MINIMUM_TOUCH_TARGET, justifyContent: 'center' },
    headerButtonText: { fontSize: 15, fontWeight: '600' },
    headerCenter: { alignItems: 'center' },
    difficultyText: { fontSize: 16, fontWeight: '700' },
    timerText: { fontSize: 13 },
    strikesText: { fontSize: 15, fontWeight: '700', textAlign: 'right' },
    boardWrapper: { alignItems: 'center' },
    hintCard: { borderRadius: 12, borderWidth: 1, padding: 12, gap: 10 },
    hintText: { fontSize: 14, lineHeight: 20 },
    hintApplyButton: {
      alignSelf: 'flex-start',
      borderRadius: 8,
      borderWidth: 1,
      paddingHorizontal: 14,
      paddingVertical: 10,
      minHeight: MINIMUM_TOUCH_TARGET,
      justifyContent: 'center',
    },
    hintApplyText: { fontSize: 14, fontWeight: '600' },
    resultCard: { borderRadius: 12, borderWidth: 1, padding: 20, gap: 10, alignItems: 'center' },
    resultTitle: { fontSize: 22, fontWeight: '700' },
    resultDetail: { fontSize: 14, textAlign: 'center' },
    primaryButton: {
      borderRadius: 10,
      paddingHorizontal: 24,
      minHeight: MINIMUM_TOUCH_TARGET,
      justifyContent: 'center',
      marginTop: 4,
    },
    primaryButtonText: { fontSize: 15, fontWeight: '700' },
    emptyState: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16 },
    emptyText: { fontSize: 15 },
  });
}
