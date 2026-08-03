/**
 * The single-cell techniques — the entire vocabulary of an easy puzzle.
 *
 * They are split into four rather than folded into one because the split *is*
 * the bottom of the difficulty ladder: a puzzle solvable by full houses and
 * naked singles alone is a different experience from one that needs hidden
 * singles in a line, and grading has to be able to tell them apart.
 */

import {
  ALL_UNITS,
  countCandidates,
  describeCell,
  describeUnit,
  maskOfDigit,
  soleDigitInMask,
} from '../board';
import {
  ALL_DIGITS,
  CELL_COUNT,
  EMPTY_CELL,
  type Board,
  type Technique,
  type TechniqueId,
  type TechniqueResult,
  type Unit,
} from '../types';

const ROW_AND_COLUMN_UNITS = ALL_UNITS.filter((unit) => unit.kind !== 'box');
const BOX_UNITS = ALL_UNITS.filter((unit) => unit.kind === 'box');

/** A unit with exactly one empty cell: that cell takes the missing digit. */
export const findFullHouse: Technique = (board: Board): TechniqueResult | null => {
  for (const unit of ALL_UNITS) {
    let emptyCellIndex = -1;
    let emptyCellCount = 0;

    for (const cellIndex of unit.cellIndexes) {
      if (board.digits[cellIndex] === EMPTY_CELL) {
        emptyCellCount += 1;
        emptyCellIndex = cellIndex;
      }
    }

    if (emptyCellCount !== 1 || countCandidates(board.candidates[emptyCellIndex]) !== 1) {
      continue;
    }

    const digit = soleDigitInMask(board.candidates[emptyCellIndex]);
    return {
      technique: 'fullHouse',
      placements: [{ cellIndex: emptyCellIndex, digit }],
      eliminations: [],
      reasonCellIndexes: unit.cellIndexes.filter(
        (otherCell) => otherCell !== emptyCellIndex,
      ),
      explanation: `${describeUnit(unit)} has only one empty cell, so ${describeCell(
        emptyCellIndex,
      )} must be ${digit}.`,
    };
  }

  return null;
};

/** A cell with exactly one remaining candidate. */
export const findNakedSingle: Technique = (board: Board): TechniqueResult | null => {
  for (let cellIndex = 0; cellIndex < CELL_COUNT; cellIndex += 1) {
    if (board.digits[cellIndex] !== EMPTY_CELL) {
      continue;
    }
    if (countCandidates(board.candidates[cellIndex]) !== 1) {
      continue;
    }

    const digit = soleDigitInMask(board.candidates[cellIndex]);
    return {
      technique: 'nakedSingle',
      placements: [{ cellIndex, digit }],
      eliminations: [],
      reasonCellIndexes: [cellIndex],
      explanation: `${digit} is the only candidate left in ${describeCell(cellIndex)}.`,
    };
  }

  return null;
};

function findHiddenSingleWithin(
  board: Board,
  units: readonly Unit[],
  technique: TechniqueId,
): TechniqueResult | null {
  for (const unit of units) {
    for (const digit of ALL_DIGITS) {
      const digitMask = maskOfDigit(digit);
      let onlyCellIndex = -1;
      let possibleCellCount = 0;
      let digitAlreadyPlaced = false;

      for (const cellIndex of unit.cellIndexes) {
        if (board.digits[cellIndex] === digit) {
          digitAlreadyPlaced = true;
          break;
        }
        if ((board.candidates[cellIndex] & digitMask) !== 0) {
          possibleCellCount += 1;
          onlyCellIndex = cellIndex;
        }
      }

      if (digitAlreadyPlaced || possibleCellCount !== 1) {
        continue;
      }

      return {
        technique,
        placements: [{ cellIndex: onlyCellIndex, digit }],
        eliminations: [],
        reasonCellIndexes: unit.cellIndexes.filter(
          (otherCell) => otherCell !== onlyCellIndex,
        ),
        explanation: `${describeCell(
          onlyCellIndex,
        )} is the only cell in ${describeUnit(unit)} that can hold ${digit}.`,
      };
    }
  }

  return null;
}

/** A digit with exactly one possible cell inside a box. */
export const findHiddenSingleInBox: Technique = (board: Board) =>
  findHiddenSingleWithin(board, BOX_UNITS, 'hiddenSingleBox');

/**
 * A digit with exactly one possible cell inside a row or column. Harder to
 * spot than the box case — a box is nine adjacent cells the eye takes in at
 * once, a line is nine cells spread across the grid.
 */
export const findHiddenSingleInLine: Technique = (board: Board) =>
  findHiddenSingleWithin(board, ROW_AND_COLUMN_UNITS, 'hiddenSingleLine');
