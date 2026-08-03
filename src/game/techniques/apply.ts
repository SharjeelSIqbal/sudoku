import { eliminateCandidate, placeDigit } from '../board';
import { type Board, type TechniqueResult } from '../types';

/**
 * Applies a technique's findings to a board in place. Shared by the grader and
 * by the forcing-chain technique, which needs to propagate a hypothesis.
 */
export function applyTechniqueResult(board: Board, result: TechniqueResult): void {
  for (const placement of result.placements) {
    placeDigit(board, placement.cellIndex, placement.digit);
  }
  for (const elimination of result.eliminations) {
    eliminateCandidate(board, elimination.cellIndex, elimination.digit);
  }
}
