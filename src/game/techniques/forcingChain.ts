/**
 * Forcing chains — the master-tier technique, and the only one that reasons by
 * hypothesis rather than by pattern.
 *
 * Take a cell with two candidates, assume one of them, and push the cheap
 * techniques as far as they go. If that assumption breaks the board, the other
 * candidate is proven. This is what a strong human player does at the end of a
 * hard puzzle, and it is deliberately the *last* thing the ladder reaches for:
 * any puzzle that needs it is Master by definition.
 *
 * Note the difference from `solver.ts`. The brute-force solver would also find
 * this digit, but by searching rather than proving, and a search result cannot
 * tell a player *why*. Only techniques justify a move.
 */

import { cloneBoard, countCandidates, describeCell, digitsInMask, hasContradiction, placeDigit } from '../board';
import {
  CELL_COUNT,
  EMPTY_CELL,
  type Board,
  type Technique,
  type TechniqueResult,
} from '../types';
import { applyTechniqueResult } from './apply';
import {
  findClaimingCandidates,
  findPointingCandidates,
} from './lockedCandidates';
import { findHiddenPair } from './hiddenSubsets';
import { findNakedPair } from './nakedSubsets';
import {
  findFullHouse,
  findHiddenSingleInBox,
  findHiddenSingleInLine,
  findNakedSingle,
} from './singles';

/**
 * The techniques a hypothesis is pushed through. Deliberately cheap ones only:
 * a hypothesis explored with expensive techniques costs more than the whole
 * rest of the ladder, and in practice adds very little reach.
 */
const PROPAGATION_TECHNIQUES: readonly Technique[] = [
  findFullHouse,
  findNakedSingle,
  findHiddenSingleInBox,
  findHiddenSingleInLine,
  findPointingCandidates,
  findClaimingCandidates,
  findNakedPair,
  findHiddenPair,
];

/** Bounds a runaway hypothesis; 81 placements is a full grid. */
const MAX_PROPAGATION_STEPS = 200;

/**
 * Pushes the cheap techniques through a board that already holds a hypothesis
 * and reports whether it collapses. Exported because move justification asks
 * the same question of a single cell.
 */
export function hypothesisBreaksBoard(board: Board): boolean {
  for (let step = 0; step < MAX_PROPAGATION_STEPS; step += 1) {
    if (hasContradiction(board)) {
      return true;
    }

    let anyTechniqueFired = false;
    for (const technique of PROPAGATION_TECHNIQUES) {
      const result = technique(board);
      if (result !== null) {
        applyTechniqueResult(board, result);
        anyTechniqueFired = true;
        break;
      }
    }

    if (!anyTechniqueFired) {
      break;
    }
  }

  return hasContradiction(board);
}

export const findForcingChain: Technique = (board: Board): TechniqueResult | null => {
  for (let cellIndex = 0; cellIndex < CELL_COUNT; cellIndex += 1) {
    if (
      board.digits[cellIndex] !== EMPTY_CELL ||
      countCandidates(board.candidates[cellIndex]) !== 2
    ) {
      continue;
    }

    const [firstDigit, secondDigit] = digitsInMask(board.candidates[cellIndex]);

    for (const [assumedDigit, provenDigit] of [
      [firstDigit, secondDigit],
      [secondDigit, firstDigit],
    ]) {
      const trialBoard = cloneBoard(board);
      placeDigit(trialBoard, cellIndex, assumedDigit);

      if (!hypothesisBreaksBoard(trialBoard)) {
        continue;
      }

      return {
        technique: 'forcingChain',
        placements: [{ cellIndex, digit: provenDigit }],
        eliminations: [],
        reasonCellIndexes: [cellIndex],
        explanation: `Forcing chain: assuming ${describeCell(
          cellIndex,
        )} is ${assumedDigit} breaks the grid, so it must be ${provenDigit}.`,
      };
    }
  }

  return null;
};
