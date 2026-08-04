/**
 * Basic fish: X-Wing (2), Swordfish (3), Jellyfish (4).
 *
 * If a digit's possible positions across N rows all fall within the same N
 * columns, then those N columns are spoken for by those N rows, and the digit
 * can be struck from those columns everywhere else. The argument works with
 * rows and columns swapped, so each size is searched in both orientations.
 */

import {
  CELLS_IN_COLUMN,
  CELLS_IN_ROW,
  COLUMN_OF_CELL,
  ROW_OF_CELL,
  describeCell,
  maskOfDigit,
} from '../board';
import {
  ALL_DIGITS,
  BOARD_SIZE,
  EMPTY_CELL,
  type Board,
  type Digit,
  type Elimination,
  type Technique,
  type TechniqueId,
  type TechniqueResult,
} from '../types';
import { combinationsOfSize } from './combinations';

interface BaseLine {
  lineIndex: number;
  /** Positions across the line where the digit is still possible. */
  positions: number[];
  cellsAtPositions: number[];
}

function findFishOfSize(
  board: Board,
  fishSize: number,
  technique: TechniqueId,
  fishName: string,
): TechniqueResult | null {
  for (const digit of ALL_DIGITS) {
    const digitMask = maskOfDigit(digit);

    for (const baseIsRow of [true, false]) {
      const baseLines: BaseLine[] = [];

      for (let lineIndex = 0; lineIndex < BOARD_SIZE; lineIndex += 1) {
        const lineCells = baseIsRow ? CELLS_IN_ROW[lineIndex] : CELLS_IN_COLUMN[lineIndex];
        const cellsAtPositions = lineCells.filter(
          (cellIndex) =>
            board.digits[cellIndex] === EMPTY_CELL &&
            (board.candidates[cellIndex] & digitMask) !== 0,
        );
        const positions = cellsAtPositions.map((cellIndex) =>
          baseIsRow ? COLUMN_OF_CELL[cellIndex] : ROW_OF_CELL[cellIndex],
        );

        // A line with one position is a hidden single; with more than the fish
        // size it cannot be confined by the cover set.
        if (positions.length >= 2 && positions.length <= fishSize) {
          baseLines.push({ lineIndex, positions, cellsAtPositions });
        }
      }

      if (baseLines.length < fishSize) {
        continue;
      }

      for (const chosenLines of combinationsOfSize(baseLines, fishSize)) {
        const coverPositions = new Set<number>();
        for (const baseLine of chosenLines) {
          for (const position of baseLine.positions) {
            coverPositions.add(position);
          }
        }

        if (coverPositions.size !== fishSize) {
          continue;
        }

        const chosenLineIndexes = new Set(chosenLines.map((baseLine) => baseLine.lineIndex));
        const eliminations: Elimination[] = [];

        for (const position of coverPositions) {
          const coverCells = baseIsRow ? CELLS_IN_COLUMN[position] : CELLS_IN_ROW[position];
          for (const cellIndex of coverCells) {
            const lineIndex = baseIsRow ? ROW_OF_CELL[cellIndex] : COLUMN_OF_CELL[cellIndex];
            if (chosenLineIndexes.has(lineIndex)) {
              continue;
            }
            if (
              board.digits[cellIndex] === EMPTY_CELL &&
              (board.candidates[cellIndex] & digitMask) !== 0
            ) {
              eliminations.push({ cellIndex, digit });
            }
          }
        }

        if (eliminations.length === 0) {
          continue;
        }

        const reasonCellIndexes = chosenLines.flatMap((baseLine) => baseLine.cellsAtPositions);
        const baseName = baseIsRow ? 'rows' : 'columns';
        const coverName = baseIsRow ? 'columns' : 'rows';
        const baseLabel = chosenLines
          .map((baseLine) => baseLine.lineIndex + 1)
          .join('/');
        const coverLabel = [...coverPositions]
          .sort((left, right) => left - right)
          .map((position) => position + 1)
          .join('/');

        return {
          technique,
          placements: [],
          eliminations,
          reasonCellIndexes,
          explanation: `${fishName} on ${digit}: in ${baseName} ${baseLabel} the digit is confined to ${coverName} ${coverLabel} (${reasonCellIndexes
            .map(describeCell)
            .join(', ')}), so ${digit} goes from those ${coverName} elsewhere.`,
        };
      }
    }
  }

  return null;
}

export const findXWing: Technique = (board: Board) =>
  findFishOfSize(board, 2, 'xWing', 'X-Wing');

export const findSwordfish: Technique = (board: Board) =>
  findFishOfSize(board, 3, 'swordfish', 'Swordfish');

export const findJellyfish: Technique = (board: Board) =>
  findFishOfSize(board, 4, 'jellyfish', 'Jellyfish');

/** Exported for the fish tests, which check both orientations explicitly. */
export function fishDigitPositions(
  board: Board,
  digit: Digit,
  baseIsRow: boolean,
  lineIndex: number,
): number[] {
  const digitMask = maskOfDigit(digit);
  const lineCells = baseIsRow ? CELLS_IN_ROW[lineIndex] : CELLS_IN_COLUMN[lineIndex];
  return lineCells
    .filter(
      (cellIndex) =>
        board.digits[cellIndex] === EMPTY_CELL &&
        (board.candidates[cellIndex] & digitMask) !== 0,
    )
    .map((cellIndex) => (baseIsRow ? COLUMN_OF_CELL[cellIndex] : ROW_OF_CELL[cellIndex]));
}
