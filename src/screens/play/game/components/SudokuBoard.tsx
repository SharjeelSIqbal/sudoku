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

/**
 * The outer rule around the grid.
 *
 * This number has to be added back into the container's width and height.
 * React Native sizes borders inside the box, so a container of exactly
 * `cellSize * 9` leaves only `cellSize * 9 - BOARD_BORDER_WIDTH * 2` of usable
 * room — four points short of nine cells. The ninth cell of every row then
 * wraps onto the next line, and the grid silently shifts by one more cell per
 * row. It still looks like a 9x9 board at a glance, which is what makes it
 * nasty: the giveaway is a blank gutter down the right-hand side.
 */
export const BOARD_BORDER_WIDTH = 2;

export interface BoardLayout {
  cellSize: number;
  /** Outer width and height of the grid container, border included. */
  containerSize: number;
}

/**
 * Sizes the grid for the space available.
 *
 * The container has to be nine cells *plus its own border on each side*.
 * React Native lays borders out inside the box, so a container of exactly
 * `cellSize * 9` leaves four points too little room, the ninth cell of each
 * row wraps onto the next line, and the whole grid shears by one more cell per
 * row. It still reads as a 9x9 board at a glance — the giveaways are a blank
 * gutter down the right-hand side and a peer highlight that comes out
 * diagonal. Kept as a pure function so that arithmetic is under test.
 */
export function boardLayoutFor(availableSize: number): BoardLayout {
  const cellSize = Math.floor(availableSize / BOARD_SIZE);
  return {
    cellSize,
    containerSize: cellSize * BOARD_SIZE + BOARD_BORDER_WIDTH * 2,
  };
}

/**
 * Every cell gets the same outline on all four sides.
 *
 * The earlier version drew only a top and left border per cell and varied the
 * weight to mark box boundaries. That leaves the last row and column with no
 * outline at all, and the varying weights read as randomly heavy lines rather
 * than as structure. The 3x3 separators are drawn as their own overlay lines
 * instead, which keeps the cell grid perfectly uniform.
 */
const CELL_BORDER_WIDTH = StyleSheet.hairlineWidth;

/** The heavier rule between boxes, drawn over the uniform cell grid. */
const BOX_RULE_WIDTH = 2;

interface SudokuBoardProps {
  game: ActiveGame;
  /** Board width in points; cells divide it evenly. */
  boardSize: number;
  highlightPeers: boolean;
  highlightSameDigit: boolean;
  onSelectCell: (cellIndex: number) => void;
}

/** The parts of a game the cell description actually reads. */
export type CellContents = Pick<ActiveGame, 'givens' | 'entries' | 'pencilMarks'>;

export interface CellVisualState {
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

export function describeCellForScreenReader(
  game: CellContents,
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
  const { cellSize, containerSize } = boardLayoutFor(boardSize);
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
          width: containerSize,
          height: containerSize,
          borderWidth: BOARD_BORDER_WIDTH,
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
                borderWidth: CELL_BORDER_WIDTH,
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

      <BoxSeparators cellSize={cellSize} color={boardColors.boxRule} />
    </View>
  );
});

/**
 * The two vertical and two horizontal rules that mark the 3x3 boxes, drawn
 * over the cell grid. `pointerEvents="none"` matters — without it these lines
 * would swallow taps on the cells underneath them.
 */
function BoxSeparators({ cellSize, color }: { cellSize: number; color: string }) {
  const boxOffsets = [1, 2];

  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      {boxOffsets.map((boxOffset) => (
        <View
          key={`vertical-${boxOffset}`}
          style={{
            position: 'absolute',
            top: 0,
            bottom: 0,
            left: cellSize * 3 * boxOffset - BOX_RULE_WIDTH / 2,
            width: BOX_RULE_WIDTH,
            backgroundColor: color,
          }}
        />
      ))}
      {boxOffsets.map((boxOffset) => (
        <View
          key={`horizontal-${boxOffset}`}
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            top: cellSize * 3 * boxOffset - BOX_RULE_WIDTH / 2,
            height: BOX_RULE_WIDTH,
            backgroundColor: color,
          }}
        />
      ))}
    </View>
  );
}

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
