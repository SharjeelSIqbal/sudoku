/**
 * Locked candidates — the first techniques that eliminate rather than place,
 * and the point where a player stops scanning and starts reasoning about
 * where a digit *cannot* go.
 */

import {
  BOX_OF_CELL,
  CELLS_IN_BOX,
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
  type TechniqueResult,
} from '../types';

function cellsHoldingCandidate(
  board: Board,
  cellIndexes: readonly number[],
  digit: Digit,
): number[] {
  const digitMask = maskOfDigit(digit);
  return cellIndexes.filter(
    (cellIndex) =>
      board.digits[cellIndex] === EMPTY_CELL &&
      (board.candidates[cellIndex] & digitMask) !== 0,
  );
}

function buildEliminations(
  cellIndexes: readonly number[],
  excludedCells: readonly number[],
  digit: Digit,
  board: Board,
): Elimination[] {
  const digitMask = maskOfDigit(digit);
  return cellIndexes
    .filter(
      (cellIndex) =>
        !excludedCells.includes(cellIndex) &&
        board.digits[cellIndex] === EMPTY_CELL &&
        (board.candidates[cellIndex] & digitMask) !== 0,
    )
    .map((cellIndex) => ({ cellIndex, digit }));
}

/**
 * Pointing: within a box, every cell that can hold a digit lies in one row or
 * one column. The digit is therefore somewhere on that line inside the box, so
 * it can be struck from the rest of the line.
 */
export const findPointingCandidates: Technique = (
  board: Board,
): TechniqueResult | null => {
  for (let boxIndex = 0; boxIndex < BOARD_SIZE; boxIndex += 1) {
    for (const digit of ALL_DIGITS) {
      const candidateCells = cellsHoldingCandidate(board, CELLS_IN_BOX[boxIndex], digit);
      if (candidateCells.length < 2) {
        continue;
      }

      const sharedRow = candidateCells.every(
        (cellIndex) => ROW_OF_CELL[cellIndex] === ROW_OF_CELL[candidateCells[0]],
      );
      const sharedColumn = candidateCells.every(
        (cellIndex) => COLUMN_OF_CELL[cellIndex] === COLUMN_OF_CELL[candidateCells[0]],
      );

      if (!sharedRow && !sharedColumn) {
        continue;
      }

      const lineCells = sharedRow
        ? CELLS_IN_ROW[ROW_OF_CELL[candidateCells[0]]]
        : CELLS_IN_COLUMN[COLUMN_OF_CELL[candidateCells[0]]];
      const eliminations = buildEliminations(lineCells, candidateCells, digit, board);

      if (eliminations.length === 0) {
        continue;
      }

      const lineName = sharedRow
        ? `row ${ROW_OF_CELL[candidateCells[0]] + 1}`
        : `column ${COLUMN_OF_CELL[candidateCells[0]] + 1}`;

      return {
        technique: 'pointingCandidates',
        placements: [],
        eliminations,
        reasonCellIndexes: candidateCells,
        explanation: `In box ${boxIndex + 1}, ${digit} can only go in ${lineName} (${candidateCells
          .map(describeCell)
          .join(', ')}), so it can be removed from the rest of that ${
          sharedRow ? 'row' : 'column'
        }.`,
      };
    }
  }

  return null;
};

/**
 * Claiming (box-line reduction): within a row or column, every cell that can
 * hold a digit lies in one box. The digit is therefore inside that box on that
 * line, so it can be struck from the rest of the box.
 */
export const findClaimingCandidates: Technique = (
  board: Board,
): TechniqueResult | null => {
  const lines = [
    ...CELLS_IN_ROW.map((cellIndexes, lineIndex) => ({
      cellIndexes,
      label: `row ${lineIndex + 1}`,
    })),
    ...CELLS_IN_COLUMN.map((cellIndexes, lineIndex) => ({
      cellIndexes,
      label: `column ${lineIndex + 1}`,
    })),
  ];

  for (const line of lines) {
    for (const digit of ALL_DIGITS) {
      const candidateCells = cellsHoldingCandidate(board, line.cellIndexes, digit);
      if (candidateCells.length < 2) {
        continue;
      }

      const boxIndex = BOX_OF_CELL[candidateCells[0]];
      const shareOneBox = candidateCells.every(
        (cellIndex) => BOX_OF_CELL[cellIndex] === boxIndex,
      );
      if (!shareOneBox) {
        continue;
      }

      const eliminations = buildEliminations(
        CELLS_IN_BOX[boxIndex],
        candidateCells,
        digit,
        board,
      );
      if (eliminations.length === 0) {
        continue;
      }

      return {
        technique: 'claimingCandidates',
        placements: [],
        eliminations,
        reasonCellIndexes: candidateCells,
        explanation: `In ${line.label}, ${digit} can only go inside box ${
          boxIndex + 1
        } (${candidateCells
          .map(describeCell)
          .join(', ')}), so it can be removed from the rest of that box.`,
      };
    }
  }

  return null;
};
