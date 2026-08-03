/**
 * Wing techniques: XY-Wing, XYZ-Wing and W-Wing.
 *
 * All three work the same way — whichever branch the puzzle takes, some cell
 * ends up unable to hold a particular digit — but they differ in how the
 * branch is set up, which is why they sit on different rungs of the ladder.
 */

import {
  ALL_UNITS,
  cellsArePeers,
  countCandidates,
  describeCell,
  digitsInMask,
  maskOfDigit,
} from '../board';
import {
  CELL_COUNT,
  EMPTY_CELL,
  type Board,
  type Digit,
  type Elimination,
  type Technique,
  type TechniqueResult,
} from '../types';

function bivalueCells(board: Board): number[] {
  const cells: number[] = [];
  for (let cellIndex = 0; cellIndex < CELL_COUNT; cellIndex += 1) {
    if (
      board.digits[cellIndex] === EMPTY_CELL &&
      countCandidates(board.candidates[cellIndex]) === 2
    ) {
      cells.push(cellIndex);
    }
  }
  return cells;
}

function eliminationsSeeingBoth(
  board: Board,
  firstCell: number,
  secondCell: number,
  digit: Digit,
  excludedCells: readonly number[],
): Elimination[] {
  const digitMask = maskOfDigit(digit);
  const eliminations: Elimination[] = [];

  for (let cellIndex = 0; cellIndex < CELL_COUNT; cellIndex += 1) {
    if (excludedCells.includes(cellIndex) || board.digits[cellIndex] !== EMPTY_CELL) {
      continue;
    }
    if ((board.candidates[cellIndex] & digitMask) === 0) {
      continue;
    }
    if (cellsArePeers(cellIndex, firstCell) && cellsArePeers(cellIndex, secondCell)) {
      eliminations.push({ cellIndex, digit });
    }
  }

  return eliminations;
}

/**
 * XY-Wing: a bivalue pivot {digitX, digitY} sees a pincer {digitX, digitZ} and
 * a pincer {digitY, digitZ}. The pivot is one or the other, so one pincer is
 * always digitZ — and any cell seeing both pincers cannot be.
 */
export const findXyWing: Technique = (board: Board): TechniqueResult | null => {
  const candidates = bivalueCells(board);

  for (const pivotCell of candidates) {
    const [digitX, digitY] = digitsInMask(board.candidates[pivotCell]);

    for (const firstPincer of candidates) {
      if (firstPincer === pivotCell || !cellsArePeers(firstPincer, pivotCell)) {
        continue;
      }
      const firstPincerDigits = digitsInMask(board.candidates[firstPincer]);
      if (!firstPincerDigits.includes(digitX) || firstPincerDigits.includes(digitY)) {
        continue;
      }
      const digitZ = firstPincerDigits.find((digit) => digit !== digitX);
      if (digitZ === undefined) {
        continue;
      }

      for (const secondPincer of candidates) {
        if (
          secondPincer === pivotCell ||
          secondPincer === firstPincer ||
          !cellsArePeers(secondPincer, pivotCell)
        ) {
          continue;
        }
        const secondPincerDigits = digitsInMask(board.candidates[secondPincer]);
        if (
          secondPincerDigits.length !== 2 ||
          !secondPincerDigits.includes(digitY) ||
          !secondPincerDigits.includes(digitZ)
        ) {
          continue;
        }

        const eliminations = eliminationsSeeingBoth(board, firstPincer, secondPincer, digitZ, [
          pivotCell,
          firstPincer,
          secondPincer,
        ]);
        if (eliminations.length === 0) {
          continue;
        }

        return {
          technique: 'xyWing',
          placements: [],
          eliminations,
          reasonCellIndexes: [pivotCell, firstPincer, secondPincer],
          explanation: `XY-Wing: pivot ${describeCell(pivotCell)} (${digitX}/${digitY}) with pincers ${describeCell(
            firstPincer,
          )} and ${describeCell(
            secondPincer,
          )} means one of them is ${digitZ}, so ${digitZ} goes from any cell seeing both.`,
        };
      }
    }
  }

  return null;
};

/**
 * XYZ-Wing: the pivot holds all three digits, so the eliminating cell must see
 * the pivot as well as both pincers — a stricter requirement than XY-Wing,
 * which is why it fires less often and sits a tier higher.
 */
export const findXyzWing: Technique = (board: Board): TechniqueResult | null => {
  const pincerCandidates = bivalueCells(board);

  for (let pivotCell = 0; pivotCell < CELL_COUNT; pivotCell += 1) {
    if (
      board.digits[pivotCell] !== EMPTY_CELL ||
      countCandidates(board.candidates[pivotCell]) !== 3
    ) {
      continue;
    }
    const pivotDigits = digitsInMask(board.candidates[pivotCell]);

    for (const firstPincer of pincerCandidates) {
      if (!cellsArePeers(firstPincer, pivotCell)) {
        continue;
      }
      const firstPincerDigits = digitsInMask(board.candidates[firstPincer]);
      if (!firstPincerDigits.every((digit) => pivotDigits.includes(digit))) {
        continue;
      }

      for (const secondPincer of pincerCandidates) {
        if (secondPincer === firstPincer || !cellsArePeers(secondPincer, pivotCell)) {
          continue;
        }
        const secondPincerDigits = digitsInMask(board.candidates[secondPincer]);
        if (!secondPincerDigits.every((digit) => pivotDigits.includes(digit))) {
          continue;
        }

        const sharedDigits = firstPincerDigits.filter((digit) =>
          secondPincerDigits.includes(digit),
        );
        if (sharedDigits.length !== 1) {
          continue;
        }
        const digitZ = sharedDigits[0];

        const eliminations = eliminationsSeeingBoth(board, firstPincer, secondPincer, digitZ, [
          pivotCell,
          firstPincer,
          secondPincer,
        ]).filter((elimination) => cellsArePeers(elimination.cellIndex, pivotCell));

        if (eliminations.length === 0) {
          continue;
        }

        return {
          technique: 'xyzWing',
          placements: [],
          eliminations,
          reasonCellIndexes: [pivotCell, firstPincer, secondPincer],
          explanation: `XYZ-Wing: pivot ${describeCell(pivotCell)} (${pivotDigits.join(
            '/',
          )}) with pincers ${describeCell(firstPincer)} and ${describeCell(
            secondPincer,
          )} forces ${digitZ} into one of the three, so ${digitZ} goes from any cell seeing all of them.`,
        };
      }
    }
  }

  return null;
};

/**
 * W-Wing: two cells hold the same pair {digitX, digitY} and are joined by a
 * unit in which digitX has exactly two homes, one seeing each cell. Either way
 * the link resolves, one of the pair cells is digitY, so digitY goes from any
 * cell seeing both.
 */
export const findWWing: Technique = (board: Board): TechniqueResult | null => {
  const candidates = bivalueCells(board);

  for (let firstIndex = 0; firstIndex < candidates.length; firstIndex += 1) {
    for (let secondIndex = firstIndex + 1; secondIndex < candidates.length; secondIndex += 1) {
      const firstCell = candidates[firstIndex];
      const secondCell = candidates[secondIndex];

      if (board.candidates[firstCell] !== board.candidates[secondCell]) {
        continue;
      }
      if (cellsArePeers(firstCell, secondCell)) {
        continue;
      }

      const pairDigits = digitsInMask(board.candidates[firstCell]);

      for (const linkDigit of pairDigits) {
        const eliminatedDigit = pairDigits.find((digit) => digit !== linkDigit);
        if (eliminatedDigit === undefined) {
          continue;
        }
        const linkMask = maskOfDigit(linkDigit);

        for (const unit of ALL_UNITS) {
          const linkCells = unit.cellIndexes.filter(
            (cellIndex) =>
              board.digits[cellIndex] === EMPTY_CELL &&
              (board.candidates[cellIndex] & linkMask) !== 0,
          );
          if (linkCells.length !== 2) {
            continue;
          }
          if (linkCells.includes(firstCell) || linkCells.includes(secondCell)) {
            continue;
          }

          const [linkOne, linkTwo] = linkCells;
          const linksConnectThePair =
            (cellsArePeers(linkOne, firstCell) && cellsArePeers(linkTwo, secondCell)) ||
            (cellsArePeers(linkOne, secondCell) && cellsArePeers(linkTwo, firstCell));
          if (!linksConnectThePair) {
            continue;
          }

          const eliminations = eliminationsSeeingBoth(
            board,
            firstCell,
            secondCell,
            eliminatedDigit,
            [firstCell, secondCell, linkOne, linkTwo],
          );
          if (eliminations.length === 0) {
            continue;
          }

          return {
            technique: 'wWing',
            placements: [],
            eliminations,
            reasonCellIndexes: [firstCell, secondCell, linkOne, linkTwo],
            explanation: `W-Wing: ${describeCell(firstCell)} and ${describeCell(
              secondCell,
            )} both hold ${pairDigits.join(
              '/',
            )}, linked by the two ${linkDigit}s in ${unit.kind} ${
              unit.indexWithinKind + 1
            }, so ${eliminatedDigit} goes from any cell seeing both.`,
          };
        }
      }
    }
  }

  return null;
};
