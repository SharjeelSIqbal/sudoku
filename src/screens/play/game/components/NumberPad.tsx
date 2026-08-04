/**
 * The digit keypad and the action row.
 *
 * Keys report how many of each digit are still unplaced, which is a real
 * solving aid and costs nothing — and they grey out once a digit is finished,
 * so a player is never hunting for a nine that has all nine placed.
 */

import { Pressable, StyleSheet, Text, View } from 'react-native';

import { ALL_DIGITS, BOARD_SIZE, EMPTY_CELL, type Digit } from '../../../../game/types';
import { type ActiveGame } from '../../../../state/GameContext';
import { type InputMode } from '../../../../state/SettingsContext';
import { useC } from '../../../../theme/colors';
import { MINIMUM_TOUCH_TARGET } from '../../home/constants';

interface NumberPadProps {
  game: ActiveGame;
  inputMode: InputMode;
  onPressDigit: (digit: Digit) => void;
  onErase: () => void;
  onUndo: () => void;
  onTogglePencilMode: () => void;
  onHint: () => void;
  canUndo: boolean;
}

/**
 * Tells the player what the pad is waiting for.
 *
 * Without this the pad just sits there and a tap on a square appears to do
 * nothing, because the digit is the second half of the gesture. Saying so is
 * cheaper than expecting anyone to infer it.
 */
function promptForInputState(
  inputMode: InputMode,
  hasSelectedCell: boolean,
  hasSelectedDigit: boolean,
): string {
  if (inputMode === 'digit-first') {
    return hasSelectedDigit
      ? 'Now tap the squares that digit goes in.'
      : 'Tap a number, then the squares it goes in.';
  }
  return hasSelectedCell
    ? 'Now tap a number.'
    : 'Tap a square, then tap a number.';
}

/** How many of each digit are still missing from the grid. */
function remainingCountsByDigit(game: ActiveGame): Record<number, number> {
  const placedCounts: Record<number, number> = {};
  for (const digit of ALL_DIGITS) {
    placedCounts[digit] = 0;
  }

  for (let cellIndex = 0; cellIndex < game.givens.length; cellIndex += 1) {
    const digit =
      game.givens[cellIndex] !== EMPTY_CELL
        ? game.givens[cellIndex]
        : game.entries[cellIndex];
    if (digit !== EMPTY_CELL) {
      placedCounts[digit] += 1;
    }
  }

  const remaining: Record<number, number> = {};
  for (const digit of ALL_DIGITS) {
    remaining[digit] = BOARD_SIZE - placedCounts[digit];
  }
  return remaining;
}

export function NumberPad({
  game,
  inputMode,
  onPressDigit,
  onErase,
  onUndo,
  onTogglePencilMode,
  onHint,
  canUndo,
}: NumberPadProps) {
  const colors = useC();
  const styles = createStyles();
  const remaining = remainingCountsByDigit(game);

  const hasSelectedCell =
    game.selectedCellIndex !== null && game.givens[game.selectedCellIndex] === EMPTY_CELL;
  const hasSelectedDigit = game.selectedDigit !== null;
  // In cell-first the digits do nothing until a square is chosen, so they are
  // dimmed rather than silently inert.
  const isAwaitingCell = inputMode === 'cell-first' && !hasSelectedCell;

  return (
    <View style={styles.container}>
      <Text style={[styles.prompt, { color: colors.foregroundMuted }]}>
        {promptForInputState(inputMode, hasSelectedCell, hasSelectedDigit)}
      </Text>

      <View style={styles.actionRow}>
        <ActionButton label="Undo" onPress={onUndo} disabled={!canUndo} />
        <ActionButton label="Erase" onPress={onErase} />
        <ActionButton
          label={game.isPencilMode ? 'Notes on' : 'Notes'}
          onPress={onTogglePencilMode}
          isActive={game.isPencilMode}
        />
        <ActionButton label="Hint" onPress={onHint} />
      </View>

      <View style={styles.digitRow}>
        {ALL_DIGITS.map((digit) => {
          const isExhausted = remaining[digit] <= 0;
          const isSelected = inputMode === 'digit-first' && game.selectedDigit === digit;

          return (
            <Pressable
              key={digit}
              accessibilityRole="button"
              accessibilityLabel={`${digit}, ${remaining[digit]} remaining`}
              accessibilityState={{ selected: isSelected, disabled: isExhausted }}
              disabled={isExhausted}
              onPress={() => onPressDigit(digit)}
              style={({ pressed }) => [
                styles.digitButton,
                {
                  backgroundColor: isSelected ? colors.accent : colors.surface,
                  borderColor: isSelected ? colors.accent : colors.rule,
                  opacity: isExhausted || isAwaitingCell ? 0.35 : pressed ? 0.7 : 1,
                },
              ]}
            >
              <Text
                style={[
                  styles.digitText,
                  { color: isSelected ? colors.accentForeground : colors.foreground },
                ]}
              >
                {digit}
              </Text>
              <Text
                style={[
                  styles.remainingText,
                  {
                    color: isSelected ? colors.accentForeground : colors.foregroundMuted,
                  },
                ]}
              >
                {remaining[digit]}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

function ActionButton({
  label,
  onPress,
  disabled = false,
  isActive = false,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  isActive?: boolean;
}) {
  const colors = useC();
  const styles = createStyles();

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled, selected: isActive }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.actionButton,
        {
          backgroundColor: isActive ? colors.surfaceRaised : colors.surface,
          borderColor: isActive ? colors.accent : colors.rule,
          opacity: disabled ? 0.4 : pressed ? 0.7 : 1,
        },
      ]}
    >
      <Text style={[styles.actionText, { color: colors.foreground }]}>{label}</Text>
    </Pressable>
  );
}

function createStyles() {
  return StyleSheet.create({
    container: { gap: 10 },
    prompt: { fontSize: 13, textAlign: 'center' },
    actionRow: { flexDirection: 'row', gap: 8 },
    actionButton: {
      flex: 1,
      minHeight: MINIMUM_TOUCH_TARGET,
      borderRadius: 10,
      borderWidth: 1,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 4,
    },
    actionText: { fontSize: 13, fontWeight: '600' },
    digitRow: { flexDirection: 'row', gap: 4 },
    digitButton: {
      flex: 1,
      minHeight: MINIMUM_TOUCH_TARGET + 8,
      borderRadius: 10,
      borderWidth: 1,
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 6,
    },
    digitText: { fontSize: 22, fontWeight: '600' },
    remainingText: { fontSize: 10 },
  });
}
