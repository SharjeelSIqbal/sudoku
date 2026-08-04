/**
 * The 9x9 grid.
 *
 * A grid is hostile to VoiceOver by default — eighty-one unlabelled squares —
 * so every cell announces its position, its contents and its state. That is
 * the single highest-value accessibility decision in the app, and it is
 * cheaper to keep than to retrofit.
 *
 * Colour is never the only signal. A wrong entry is amber *and* bold; a hinted
 * cell is tinted *and* outlined. Red-versus-green is avoided entirely.
 */

import { memo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import {
  BOX_OF_CELL,
  COLUMN_OF_CELL,
  ROW_OF_CELL,
  digitsInMask,
} from '../../../../game/board';
import {
  ALL_DIGITS,
  BOARD_SIZE,
  CELL_COUNT,
  EMPTY_CELL,
  type Digit,
} from '../../../../game/types';
import { type ActiveGame } from '../../../../state/GameContext';
import { useC, type BoardColors } from '../../../../theme/colors';

interface SudokuBoardProps {
  game: ActiveGame;
  /** Board width in points; cells divide it evenly. */
  boardSize: number;
  highlightPeers: boolean;
  highlightSameDigit: boolean;
  onSelectCell: (cellIndex: number) => void;
}

interface CellVisualState {
  isGiven: boolean;
  isSelected: boolean;
  isPeer: boolean;
  isSameDigit: boolean;
  isConflicted: boolean;
  isHinted: boolean;
}

function backgroundForCell(
  state: CellVisualState,
  boardColors: BoardColors,
): string {
  if (state.isHinted) {
    return boardColors.hintSurface;
  }
  if (state.isConflicted) {
    return boardColors.conflictSurface;
  }
  if (state.isSelected) {
    return boardColors.selected;
  }
  if (state.isSameDigit) {
    return boardColors.sameDigitHighlight;
  }
  if (state.isPeer) {
    return boardColors.peerHighlight;
  }
  return boardColors.surface;
}

function describeCellForScreenReader(
  game: ActiveGame,
  cellIndex: number,
  state: CellVisualState,
): string {
  const rowNumber = ROW_OF_CELL[cellIndex] + 1;
  const columnNumber = COLUMN_OF_CELL[cellIndex] + 1;
  const position = `Row ${rowNumber}, column ${columnNumber}`;

  const digit =
    game.givens[cellIndex] !== EMPTY_CELL
      ? game.givens[cellIndex]
      : game.entries[cellIndex];

  if (digit === EMPTY_CELL) {
    const marks = digitsInMask(game.pencilMarks[cellIndex]);
    return marks.length > 0
      ? `${position}, empty, pencil marks ${marks.join(', ')}`
      : `${position}, empty`;
  }

  if (state.isGiven) {
    return `${position}, ${digit}, given`;
  }
  // Only announce wrongness when the game would show it; with validation off
  // the screen reader must not leak what the screen is deliberately hiding.
  return state.isConflicted
    ? `${position}, ${digit}, incorrect`
    : `${position}, ${digit}`;
}

export const SudokuBoard = memo(function SudokuBoard({
  game,
  boardSize,
  highlightPeers,
  highlightSameDigit,
  onSelectCell,
}: SudokuBoardProps) {
  const colors = useC();
  const boardColors = colors.board;
  const cellSize = Math.floor(boardSize / BOARD_SIZE);
  const styles = createStyles();

  const selectedCellIndex = game.selectedCellIndex;
  const selectedDigit =
    selectedCellIndex === null
      ? EMPTY_CELL
      : game.givens[selectedCellIndex] !== EMPTY_CELL
        ? game.givens[selectedCellIndex]
        : game.entries[selectedCellIndex];

  const hintedCells = new Set(game.activeHint?.placements.map((placement) => placement.cellIndex) ?? []);

  return (
    <View
      style={[
        styles.board,
        {
          width: cellSize * BOARD_SIZE,
          height: cellSize * BOARD_SIZE,
          borderColor: boardColors.boxRule,
          backgroundColor: boardColors.surface,
        },
      ]}
    >
      {Array.from({ length: CELL_COUNT }, (_, cellIndex) => {
        const isGiven = game.givens[cellIndex] !== EMPTY_CELL;
        const digit = isGiven ? game.givens[cellIndex] : game.entries[cellIndex];

        const state: CellVisualState = {
          isGiven,
          isSelected: selectedCellIndex === cellIndex,
          isPeer:
            highlightPeers &&
            selectedCellIndex !== null &&
            selectedCellIndex !== cellIndex &&
            (ROW_OF_CELL[selectedCellIndex] === ROW_OF_CELL[cellIndex] ||
              COLUMN_OF_CELL[selectedCellIndex] === COLUMN_OF_CELL[cellIndex] ||
              BOX_OF_CELL[selectedCellIndex] === BOX_OF_CELL[cellIndex]),
          isSameDigit:
            highlightSameDigit &&
            digit !== EMPTY_CELL &&
            digit === selectedDigit &&
            selectedCellIndex !== cellIndex,
          isConflicted: game.conflictedCells.includes(cellIndex),
          isHinted: hintedCells.has(cellIndex),
        };

        const rowIndex = ROW_OF_CELL[cellIndex];
        const columnIndex = COLUMN_OF_CELL[cellIndex];

        return (
          <Pressable
            key={cellIndex}
            accessibilityRole="button"
            accessibilityLabel={describeCellForScreenReader(game, cellIndex, state)}
            accessibilityState={{ selected: state.isSelected, disabled: isGiven }}
            onPress={() => onSelectCell(cellIndex)}
            style={[
              styles.cell,
              {
                width: cellSize,
                height: cellSize,
                backgroundColor: backgroundForCell(state, boardColors),
                borderColor: boardColors.rule,
                // Box boundaries get a heavier rule so the 3x3 structure reads
                // without relying on colour at all.
                borderTopWidth: rowIndex % 3 === 0 ? 1.5 : StyleSheet.hairlineWidth,
                borderLeftWidth: columnIndex % 3 === 0 ? 1.5 : StyleSheet.hairlineWidth,
                borderTopColor: rowIndex % 3 === 0 ? boardColors.boxRule : boardColors.rule,
                borderLeftColor:
                  columnIndex % 3 === 0 ? boardColors.boxRule : boardColors.rule,
              },
            ]}
          >
            {digit !== EMPTY_CELL ? (
              <Text
                allowFontScaling={false}
                style={[
                  styles.digit,
                  {
                    fontSize: cellSize * 0.58,
                    color: state.isConflicted
                      ? boardColors.conflict
                      : isGiven
                        ? boardColors.givenDigit
                        : boardColors.enteredDigit,
                    // Weight is the second channel behind colour.
                    fontWeight: isGiven ? '700' : state.isConflicted ? '800' : '500',
                  },
                ]}
              >
                {digit}
              </Text>
            ) : (
              <PencilMarks
                mask={game.pencilMarks[cellIndex]}
                cellSize={cellSize}
                color={boardColors.pencilMark}
              />
            )}
          </Pressable>
        );
      })}
    </View>
  );
});

function PencilMarks({
  mask,
  cellSize,
  color,
}: {
  mask: number;
  cellSize: number;
  color: string;
}) {
  const styles = createStyles();

  if (mask === 0) {
    return null;
  }

  return (
    <View style={styles.pencilGrid}>
      {ALL_DIGITS.map((digit: Digit) => (
        <Text
          key={digit}
          allowFontScaling={false}
          style={[
            styles.pencilMark,
            {
              width: cellSize / 3,
              fontSize: cellSize * 0.22,
              color,
              opacity: (mask & (1 << (digit - 1))) !== 0 ? 1 : 0,
            },
          ]}
        >
          {digit}
        </Text>
      ))}
    </View>
  );
}

function createStyles() {
  return StyleSheet.create({
    board: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      borderWidth: 2,
      borderRadius: 4,
      overflow: 'hidden',
    },
    cell: { alignItems: 'center', justifyContent: 'center' },
    digit: { textAlign: 'center' },
    pencilGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      alignItems: 'center',
      justifyContent: 'center',
      width: '100%',
      height: '100%',
    },
    pencilMark: { textAlign: 'center' },
  });
}
