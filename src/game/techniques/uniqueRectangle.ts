/**
 * Unique Rectangle, type 1.
 *
 * Four cells at the intersection of two rows and two columns, spanning exactly
 * two boxes, all holding the same two candidates, would give the puzzle two
 * solutions — swap the pair round and it still checks out. Since every puzzle
 * this app generates is verified unique, that pattern cannot complete, so the
 * one cell with extra candidates must take one of those extras.
 *
 * This reasoning is only sound because uniqueness is guaranteed. `generator.ts`
 * proves it for every puzzle before the bank ever sees it; if that ever stops
 * being true, this technique has to go.
 */

import {
  BOX_OF_CELL,
  cellIndexAt,
  countCandidates,
  describeCell,
  digitsInMask,
} from '../board';
import {
  BOARD_SIZE,
  EMPTY_CELL,
  type Board,
  type Elimination,
  type Technique,
  type TechniqueResult,
} from '../types';

export const findUniqueRectangle: Technique = (board: Board): TechniqueResult | null => {
  for (let firstRow = 0; firstRow < BOARD_SIZE; firstRow += 1) {
    for (let secondRow = firstRow + 1; secondRow < BOARD_SIZE; secondRow += 1) {
      for (let firstColumn = 0; firstColumn < BOARD_SIZE; firstColumn += 1) {
        for (
          let secondColumn = firstColumn + 1;
          secondColumn < BOARD_SIZE;
          secondColumn += 1
        ) {
          const corners = [
            cellIndexAt(firstRow, firstColumn),
            cellIndexAt(firstRow, secondColumn),
            cellIndexAt(secondRow, firstColumn),
            cellIndexAt(secondRow, secondColumn),
          ];

          if (corners.some((cellIndex) => board.digits[cellIndex] !== EMPTY_CELL)) {
            continue;
          }

          const distinctBoxes = new Set(corners.map((cellIndex) => BOX_OF_CELL[cellIndex]));
          if (distinctBoxes.size !== 2) {
            continue;
          }

          const bivalueCorners = corners.filter(
            (cellIndex) => countCandidates(board.candidates[cellIndex]) === 2,
          );
          if (bivalueCorners.length !== 3) {
            continue;
          }

          const pairMask = board.candidates[bivalueCorners[0]];
          if (
            !bivalueCorners.every((cellIndex) => board.candidates[cellIndex] === pairMask)
          ) {
            continue;
          }

          const extraCorner = corners.find(
            (cellIndex) => !bivalueCorners.includes(cellIndex),
          );
          if (extraCorner === undefined) {
            continue;
          }

          const extraCornerMask = board.candidates[extraCorner];
          // The fourth corner must contain both pair digits plus something
          // else, or there is no deadly pattern to break.
          if ((extraCornerMask & pairMask) !== pairMask) {
            continue;
          }
          if (countCandidates(extraCornerMask) <= 2) {
            continue;
          }

          const pairDigits = digitsInMask(pairMask);
          const eliminations: Elimination[] = pairDigits.map((digit) => ({
            cellIndex: extraCorner,
            digit,
          }));

          return {
            technique: 'uniqueRectangle',
            placements: [],
            eliminations,
            reasonCellIndexes: corners,
            explanation: `Unique Rectangle on ${pairDigits.join(
              '/',
            )}: ${bivalueCorners
              .map(describeCell)
              .join(', ')} and ${describeCell(
              extraCorner,
            )} would have two solutions if ${describeCell(
              extraCorner,
            )} held only that pair, so it must take one of its other candidates.`,
          };
        }
      }
    }
  }

  return null;
};
