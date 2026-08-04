/**
 * Hidden pairs, triples and quads.
 *
 * The mirror of a naked subset: N digits in a unit that between them can only
 * go in N cells must occupy exactly those cells, so every *other* candidate is
 * struck from those cells. Harder to see than the naked form because the
 * subset is buried among candidates that are about to be removed.
 */

import { ALL_UNITS, countCandidates, describeCell, describeUnit, maskOfDigit } from '../board';
import {
  ALL_DIGITS,
  EMPTY_CELL,
  type Board,
  type Digit,
  type Elimination,
  type Technique,
  type TechniqueId,
  type TechniqueResult,
} from '../types';
import { combinationsOfSize } from './combinations';

function findHiddenSubsetOfSize(
  board: Board,
  subsetSize: number,
  technique: TechniqueId,
  subsetName: string,
): TechniqueResult | null {
  for (const unit of ALL_UNITS) {
    const emptyCells = unit.cellIndexes.filter(
      (cellIndex) => board.digits[cellIndex] === EMPTY_CELL,
    );

    if (emptyCells.length <= subsetSize) {
      continue;
    }

    const placedMask = unit.cellIndexes.reduce((mask, cellIndex) => {
      const digit = board.digits[cellIndex];
      return digit === EMPTY_CELL ? mask : mask | maskOfDigit(digit as Digit);
    }, 0);

    const unplacedDigits = ALL_DIGITS.filter(
      (digit) => (placedMask & maskOfDigit(digit)) === 0,
    );

    for (const subsetDigits of combinationsOfSize(unplacedDigits, subsetSize)) {
      const cellsForSubset = new Set<number>();
      let subsetIsViable = true;

      for (const digit of subsetDigits) {
        const digitMask = maskOfDigit(digit);
        const cellsForDigit = emptyCells.filter(
          (cellIndex) => (board.candidates[cellIndex] & digitMask) !== 0,
        );
        // A digit with no home means the board is already broken; a digit that
        // spills past the subset size cannot be part of a hidden subset.
        if (cellsForDigit.length === 0 || cellsForDigit.length > subsetSize) {
          subsetIsViable = false;
          break;
        }
        for (const cellIndex of cellsForDigit) {
          cellsForSubset.add(cellIndex);
        }
        if (cellsForSubset.size > subsetSize) {
          subsetIsViable = false;
          break;
        }
      }

      if (!subsetIsViable || cellsForSubset.size !== subsetSize) {
        continue;
      }

      let subsetMask = 0;
      for (const digit of subsetDigits) {
        subsetMask |= maskOfDigit(digit);
      }

      const eliminations: Elimination[] = [];
      for (const cellIndex of cellsForSubset) {
        const extraMask = board.candidates[cellIndex] & ~subsetMask;
        if (extraMask === 0) {
          continue;
        }
        for (const digit of ALL_DIGITS) {
          if ((extraMask & maskOfDigit(digit)) !== 0) {
            eliminations.push({ cellIndex, digit });
          }
        }
      }

      if (eliminations.length === 0) {
        continue;
      }

      // A "hidden subset" where every cell is already down to the subset
      // digits is a naked subset wearing a hat; the cheaper technique should
      // have caught it, so do not report it as this one.
      const isActuallyHidden = [...cellsForSubset].some(
        (cellIndex) => countCandidates(board.candidates[cellIndex]) > subsetSize,
      );
      if (!isActuallyHidden) {
        continue;
      }

      return {
        technique,
        placements: [],
        eliminations,
        reasonCellIndexes: [...cellsForSubset],
        explanation: `${subsetDigits.join('/')} in ${describeUnit(
          unit,
        )} can only go in ${[...cellsForSubset]
          .map(describeCell)
          .join(', ')}, a hidden ${subsetName}, so every other candidate in those cells goes.`,
      };
    }
  }

  return null;
}

export const findHiddenPair: Technique = (board: Board) =>
  findHiddenSubsetOfSize(board, 2, 'hiddenPair', 'pair');

export const findHiddenTriple: Technique = (board: Board) =>
  findHiddenSubsetOfSize(board, 3, 'hiddenTriple', 'triple');

export const findHiddenQuad: Technique = (board: Board) =>
  findHiddenSubsetOfSize(board, 4, 'hiddenQuad', 'quad');
