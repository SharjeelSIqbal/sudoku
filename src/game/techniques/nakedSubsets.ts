/**
 * Naked pairs, triples and quads.
 *
 * N cells in a unit whose candidates between them use only N digits must use
 * up exactly those digits, so no other cell in that unit can hold any of them.
 */

import { ALL_UNITS, countCandidates, describeCell, describeUnit, digitsInMask } from '../board';
import {
  EMPTY_CELL,
  type Board,
  type Elimination,
  type Technique,
  type TechniqueId,
  type TechniqueResult,
} from '../types';
import { combinationsOfSize } from './combinations';

function findNakedSubsetOfSize(
  board: Board,
  subsetSize: number,
  technique: TechniqueId,
  subsetName: string,
): TechniqueResult | null {
  for (const unit of ALL_UNITS) {
    const emptyCells = unit.cellIndexes.filter(
      (cellIndex) => board.digits[cellIndex] === EMPTY_CELL,
    );

    // A subset needs at least one other empty cell to eliminate from,
    // otherwise it is just a restatement of the unit.
    if (emptyCells.length <= subsetSize) {
      continue;
    }

    const eligibleCells = emptyCells.filter((cellIndex) => {
      const candidateCount = countCandidates(board.candidates[cellIndex]);
      return candidateCount >= 2 && candidateCount <= subsetSize;
    });

    for (const subsetCells of combinationsOfSize(eligibleCells, subsetSize)) {
      let combinedMask = 0;
      for (const cellIndex of subsetCells) {
        combinedMask |= board.candidates[cellIndex];
      }

      if (countCandidates(combinedMask) !== subsetSize) {
        continue;
      }

      const subsetDigits = digitsInMask(combinedMask);
      const eliminations: Elimination[] = [];

      for (const cellIndex of emptyCells) {
        if (subsetCells.includes(cellIndex)) {
          continue;
        }
        for (const digit of subsetDigits) {
          if ((board.candidates[cellIndex] & (1 << (digit - 1))) !== 0) {
            eliminations.push({ cellIndex, digit });
          }
        }
      }

      if (eliminations.length === 0) {
        continue;
      }

      return {
        technique,
        placements: [],
        eliminations,
        reasonCellIndexes: subsetCells,
        explanation: `${subsetCells
          .map(describeCell)
          .join(', ')} in ${describeUnit(unit)} form a naked ${subsetName} on ${subsetDigits.join(
          '/',
        )}, so those digits can be removed from the rest of the ${unit.kind}.`,
      };
    }
  }

  return null;
}

export const findNakedPair: Technique = (board: Board) =>
  findNakedSubsetOfSize(board, 2, 'nakedPair', 'pair');

export const findNakedTriple: Technique = (board: Board) =>
  findNakedSubsetOfSize(board, 3, 'nakedTriple', 'triple');

export const findNakedQuad: Technique = (board: Board) =>
  findNakedSubsetOfSize(board, 4, 'nakedQuad', 'quad');
