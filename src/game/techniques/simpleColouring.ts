/**
 * Simple colouring (single's chains).
 *
 * Take one digit and every unit where it has exactly two homes: those two are
 * a strong link — precisely one of them is the digit. Following those links
 * two-tone across the grid produces a chain where one colour is entirely true
 * and the other entirely false. Two conclusions follow, and both are checked
 * here.
 */

import { ALL_UNITS, cellsArePeers, describeCell, maskOfDigit } from '../board';
import {
  ALL_DIGITS,
  CELL_COUNT,
  EMPTY_CELL,
  type Board,
  type Digit,
  type Elimination,
  type Technique,
  type TechniqueResult,
} from '../types';

function buildStrongLinks(board: Board, digit: Digit): Map<number, number[]> {
  const digitMask = maskOfDigit(digit);
  const links = new Map<number, number[]>();

  for (const unit of ALL_UNITS) {
    const homes = unit.cellIndexes.filter(
      (cellIndex) =>
        board.digits[cellIndex] === EMPTY_CELL &&
        (board.candidates[cellIndex] & digitMask) !== 0,
    );
    if (homes.length !== 2) {
      continue;
    }

    const [firstCell, secondCell] = homes;
    if (!links.has(firstCell)) {
      links.set(firstCell, []);
    }
    if (!links.has(secondCell)) {
      links.set(secondCell, []);
    }
    links.get(firstCell)!.push(secondCell);
    links.get(secondCell)!.push(firstCell);
  }

  return links;
}

export const findSimpleColouring: Technique = (board: Board): TechniqueResult | null => {
  for (const digit of ALL_DIGITS) {
    const digitMask = maskOfDigit(digit);
    const links = buildStrongLinks(board, digit);
    const colourOfCell = new Map<number, number>();

    for (const startCell of links.keys()) {
      if (colourOfCell.has(startCell)) {
        continue;
      }

      // Two-colour this connected component by breadth-first search.
      const componentCells: number[] = [startCell];
      colourOfCell.set(startCell, 0);
      const queue = [startCell];

      while (queue.length > 0) {
        const currentCell = queue.shift()!;
        const currentColour = colourOfCell.get(currentCell)!;
        for (const linkedCell of links.get(currentCell) ?? []) {
          if (colourOfCell.has(linkedCell)) {
            continue;
          }
          colourOfCell.set(linkedCell, 1 - currentColour);
          componentCells.push(linkedCell);
          queue.push(linkedCell);
        }
      }

      if (componentCells.length < 4) {
        continue;
      }

      const cellsByColour: [number[], number[]] = [[], []];
      for (const cellIndex of componentCells) {
        cellsByColour[colourOfCell.get(cellIndex)!].push(cellIndex);
      }

      // Colour wrap: two cells of one colour share a unit, so that colour
      // cannot be the true one — every cell of it loses the digit.
      for (const colour of [0, 1]) {
        const sameColourCells = cellsByColour[colour];
        const conflictingPair = sameColourCells.flatMap((firstCell, firstIndex) =>
          sameColourCells
            .slice(firstIndex + 1)
            .filter((secondCell) => cellsArePeers(firstCell, secondCell))
            .map((secondCell) => [firstCell, secondCell] as const),
        );

        if (conflictingPair.length === 0) {
          continue;
        }

        const eliminations: Elimination[] = sameColourCells.map((cellIndex) => ({
          cellIndex,
          digit,
        }));

        return {
          technique: 'simpleColouring',
          placements: [],
          eliminations,
          reasonCellIndexes: componentCells,
          explanation: `Colouring on ${digit}: ${describeCell(
            conflictingPair[0][0],
          )} and ${describeCell(
            conflictingPair[0][1],
          )} share a unit and take the same colour, so that whole colour is false.`,
        };
      }

      // Colour trap: a cell outside the chain that sees both colours cannot
      // hold the digit, because one of the two colours is true.
      const eliminations: Elimination[] = [];
      for (let cellIndex = 0; cellIndex < CELL_COUNT; cellIndex += 1) {
        if (
          colourOfCell.has(cellIndex) ||
          board.digits[cellIndex] !== EMPTY_CELL ||
          (board.candidates[cellIndex] & digitMask) === 0
        ) {
          continue;
        }
        const seesFirstColour = cellsByColour[0].some((colouredCell) =>
          cellsArePeers(cellIndex, colouredCell),
        );
        const seesSecondColour = cellsByColour[1].some((colouredCell) =>
          cellsArePeers(cellIndex, colouredCell),
        );
        if (seesFirstColour && seesSecondColour) {
          eliminations.push({ cellIndex, digit });
        }
      }

      if (eliminations.length > 0) {
        return {
          technique: 'simpleColouring',
          placements: [],
          eliminations,
          reasonCellIndexes: componentCells,
          explanation: `Colouring on ${digit}: ${eliminations
            .map((elimination) => describeCell(elimination.cellIndex))
            .join(', ')} can see both colours of the chain, and one colour must be true.`,
        };
      }
    }
  }

  return null;
};
