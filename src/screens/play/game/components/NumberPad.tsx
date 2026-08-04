/**
 * The digit keypad and the action row.
 *
 * The keypad is not a permanent fixture at the bottom of the screen. In
 * cell-first input it appears when a square is chosen and goes away again when
 * it is not — the digits are the second half of a gesture, so showing them
 * with nothing to apply them to is just clutter. Digit-first works the other
 * way round, choosing the digit first, so there the keypad is always present.
 *
 * There is no erase button. Tapping the digit already in a cell takes it back
 * out, which covers the same ground without a control that only ever means
 * "undo the thing you can see".
 */

import { Pressable, StyleSheet, Text, View } from 'react-native';

import { ALL_DIGITS, BOARD_SIZE, EMPTY_CELL, type Digit } from '../../../../game/types';
import { type ActiveGame } from '../../../../state/GameContext';
import { type InputMode } from '../../../../state/SettingsContext';
import { useC } from '../../../../theme/colors';
import { MINIMUM_TOUCH_TARGET } from '../../home/constants';

/** Digits per keypad row — a 3x3 block, matching the shape of a sudoku box. */
const KEYPAD_COLUMNS = 3;

/** Comfortably larger than the 44pt minimum; this is the main control. */
const KEY_HEIGHT = 60;

interface NumberPadProps {
  game: ActiveGame;
  inputMode: InputMode;
  onPressDigit: (digit: Digit) => void;
  onUndo: () => void;
  onTogglePencilMode: () => void;
  onHint: () => void;
  canUndo: boolean;
}

/** True once all nine of a digit are on the board. */
function isDigitFullyPlaced(game: ActiveGame, digit: Digit): boolean {
  let placedCount = 0;
  for (let cellIndex = 0; cellIndex < game.givens.length; cellIndex += 1) {
    const cellDigit =
      game.givens[cellIndex] !== EMPTY_CELL
        ? game.givens[cellIndex]
        : game.entries[cellIndex];
    if (cellDigit === digit) {
      placedCount += 1;
    }
  }
  return placedCount >= BOARD_SIZE;
}

export function NumberPad({
  game,
  inputMode,
  onPressDigit,
  onUndo,
  onTogglePencilMode,
  onHint,
  canUndo,
}: NumberPadProps) {
  const colors = useC();
  const styles = createStyles();

  const hasEditableCellSelected =
    game.selectedCellIndex !== null && game.givens[game.selectedCellIndex] === EMPTY_CELL;
  // Digit-first picks the digit before the square, so its keypad is the entry
  // point and has to be there from the start.
  const isKeypadVisible = inputMode === 'digit-first' || hasEditableCellSelected;

  const digitRows: Digit[][] = [];
  for (let rowStart = 0; rowStart < ALL_DIGITS.length; rowStart += KEYPAD_COLUMNS) {
    digitRows.push(ALL_DIGITS.slice(rowStart, rowStart + KEYPAD_COLUMNS) as Digit[]);
  }

  return (
    <View style={styles.container}>
      <View style={styles.actionRow}>
        <ActionButton label="Undo" onPress={onUndo} disabled={!canUndo} />
        <ActionButton
          label={game.isPencilMode ? 'Notes on' : 'Notes'}
          onPress={onTogglePencilMode}
          isActive={game.isPencilMode}
        />
        <ActionButton label="Hint" onPress={onHint} />
      </View>

      {isKeypadVisible ? (
        <View style={styles.keypad}>
          {digitRows.map((digitRow) => (
            <View key={`row-${digitRow[0]}`} style={styles.keypadRow}>
              {digitRow.map((digit) => {
                const isFullyPlaced = isDigitFullyPlaced(game, digit);
                const isSelected =
                  inputMode === 'digit-first' && game.selectedDigit === digit;

                return (
                  <Pressable
                    key={digit}
                    accessibilityRole="button"
                    accessibilityLabel={`${digit}`}
                    accessibilityState={{ selected: isSelected, disabled: isFullyPlaced }}
                    disabled={isFullyPlaced}
                    onPress={() => onPressDigit(digit)}
                    style={({ pressed }) => [
                      styles.key,
                      {
                        backgroundColor: isSelected ? colors.accent : colors.surface,
                        borderColor: isSelected ? colors.accent : colors.rule,
                        opacity: isFullyPlaced ? 0.3 : pressed ? 0.7 : 1,
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.keyText,
                        { color: isSelected ? colors.accentForeground : colors.foreground },
                      ]}
                    >
                      {digit}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          ))}
        </View>
      ) : (
        <Text style={[styles.prompt, { color: colors.foregroundMuted }]}>
          Tap a square to enter a number.
        </Text>
      )}
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
    container: { gap: 12 },
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
    actionText: { fontSize: 14, fontWeight: '600' },
    keypad: { gap: 8 },
    keypadRow: { flexDirection: 'row', gap: 8 },
    key: {
      flex: 1,
      minHeight: KEY_HEIGHT,
      borderRadius: 12,
      borderWidth: 1,
      alignItems: 'center',
      justifyContent: 'center',
    },
    keyText: { fontSize: 28, fontWeight: '600' },
    prompt: { fontSize: 14, textAlign: 'center', paddingVertical: 20 },
  });
}
