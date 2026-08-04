/**
 * Was that placement reasoned, or lucky?
 *
 * This is the engine half of the guess penalty. A correct placement is
 * *justified* when, on the board as it stood before the move, the digit was
 * already forced — reachable by eliminations the player could have made, at or
 * below the puzzle's own tier.
 *
 * Two rules keep this fair, and both are deliberate:
 *
 * 1. It works from the true candidate set, never the player's pencil marks.
 *    Marks are a UI affordance and are routinely stale or wrong; scoring off
 *    them would punish untidy note-keeping rather than guessing.
 * 2. It is capped at the puzzle's tier. Justifying an Easy placement with a
 *    forcing chain would be both slow and beside the point — nobody solving an
 *    Easy puzzle is expected to reach for one.
 *
 * Wrong placements never come through here. They are already penalised, and
 * more heavily, as wrong.
 */

import {
  ALL_UNITS,
  cloneBoard,
  countCandidates,
  digitsInMask,
  maskOfDigit,
  placeDigit,
} from './board';
import { isAtMostDifficulty } from './grading';
import { hypothesisBreaksBoard } from './techniques/forcingChain';
import { applyTechniqueResult } from './techniques/apply';
import { TECHNIQUE_LADDER } from './techniques/registry';
import { EMPTY_CELL, type Board, type Difficulty, type Digit } from './types';

export type MoveJustification = 'justified' | 'unjustified';

/** Bounds the elimination pass; each round removes at least one candidate. */
const MAX_ELIMINATION_ROUNDS = 200;

/**
 * Applies every elimination the ladder can find without placing anything.
 *
 * Placements are excluded on purpose: the question is whether *this* digit was
 * forced right now, not whether the ladder could eventually reach it by
 * filling other cells first. Allowing placements would let the ladder solve
 * the whole puzzle and call every correct move justified.
 */
function settleEliminations(board: Board, maximumDifficulty: Difficulty): void {
  // Filter by `deduces` rather than by inspecting the result: a technique that
  // only ever places is pure cost here, and `forcingChain` in particular is so
  // much more expensive than the rest of the ladder that calling it and
  // throwing the answer away dwarfed everything else judging a move.
  const availableTechniques = TECHNIQUE_LADDER.filter(
    (technique) =>
      technique.deduces === 'eliminations' &&
      isAtMostDifficulty(technique.tier, maximumDifficulty),
  );

  for (let round = 0; round < MAX_ELIMINATION_ROUNDS; round += 1) {
    let anyTechniqueFired = false;

    for (const technique of availableTechniques) {
      const result = technique.apply(board);
      if (result === null || result.eliminations.length === 0) {
        continue;
      }
      applyTechniqueResult(board, result);
      anyTechniqueFired = true;
      break;
    }

    if (!anyTechniqueFired) {
      return;
    }
  }
}

function isNakedSingleFor(board: Board, cellIndex: number, digit: Digit): boolean {
  return board.candidates[cellIndex] === maskOfDigit(digit);
}

function isHiddenSingleFor(board: Board, cellIndex: number, digit: Digit): boolean {
  const digitMask = maskOfDigit(digit);

  return ALL_UNITS.filter((unit) => unit.cellIndexes.includes(cellIndex)).some((unit) => {
    const possibleHomes = unit.cellIndexes.filter(
      (otherCell) =>
        board.digits[otherCell] === EMPTY_CELL &&
        (board.candidates[otherCell] & digitMask) !== 0,
    );
    return possibleHomes.length === 1 && possibleHomes[0] === cellIndex;
  });
}

/**
 * At master tier only: the digit counts as forced when assuming each of the
 * cell's other candidates collapses the grid.
 */
function isForcedByContradiction(board: Board, cellIndex: number, digit: Digit): boolean {
  const otherDigits = digitsInMask(board.candidates[cellIndex]).filter(
    (candidateDigit) => candidateDigit !== digit,
  );

  if (otherDigits.length === 0) {
    return true;
  }

  return otherDigits.every((candidateDigit) => {
    const trialBoard = cloneBoard(board);
    placeDigit(trialBoard, cellIndex, candidateDigit);
    return hypothesisBreaksBoard(trialBoard);
  });
}

/**
 * Judges a correct placement against the board as it was *before* the move.
 * Pass the pre-move board — passing the post-move board makes every placement
 * look justified, because the digit is already sitting there.
 */
export function judgePlacement(
  boardBeforeMove: Board,
  cellIndex: number,
  digit: Digit,
  puzzleDifficulty: Difficulty,
): MoveJustification {
  if (boardBeforeMove.digits[cellIndex] !== EMPTY_CELL) {
    // Overwriting a filled cell is not a deduction about an empty one.
    return 'unjustified';
  }

  const workingBoard = cloneBoard(boardBeforeMove);

  // A cell that is already down to one candidate needed no work at all.
  if (countCandidates(workingBoard.candidates[cellIndex]) === 1) {
    return isNakedSingleFor(workingBoard, cellIndex, digit) ? 'justified' : 'unjustified';
  }

  settleEliminations(workingBoard, puzzleDifficulty);

  if (
    isNakedSingleFor(workingBoard, cellIndex, digit) ||
    isHiddenSingleFor(workingBoard, cellIndex, digit)
  ) {
    return 'justified';
  }

  if (
    puzzleDifficulty === 'master' &&
    isForcedByContradiction(workingBoard, cellIndex, digit)
  ) {
    return 'justified';
  }

  return 'unjustified';
}
