/**
 * Logical solving and difficulty grading.
 *
 * A puzzle's tier is the hardest technique its logical path ever requires,
 * because that is what the player actually experiences: a grid that needs one
 * Swordfish is an Extreme puzzle even if the other eighty placements are
 * singles. Clue count is deliberately not consulted anywhere in this file.
 */

import { cloneBoard, isBoardSolved } from './board';
import { TECHNIQUE_LADDER, type RegisteredTechnique } from './techniques/registry';
import { applyTechniqueResult } from './techniques/apply';
import {
  DIFFICULTIES,
  type Board,
  type Difficulty,
  type LogicalSolveOutcome,
  type SolveStep,
  type TechniqueId,
} from './types';

/** Position on the ladder, 0 for easy through 5 for master. */
export function difficultyRank(difficulty: Difficulty): number {
  return DIFFICULTIES.indexOf(difficulty);
}

export function isAtMostDifficulty(
  candidate: Difficulty,
  ceiling: Difficulty,
): boolean {
  return difficultyRank(candidate) <= difficultyRank(ceiling);
}

/** The harder of two tiers. */
export function harderDifficulty(
  first: Difficulty,
  second: Difficulty,
): Difficulty {
  return difficultyRank(first) >= difficultyRank(second) ? first : second;
}

export interface LogicalSolveOptions {
  /**
   * Techniques above this tier are not attempted. Grading leaves it unset;
   * move justification sets it to the puzzle's own tier so that a placement is
   * not called a guess merely because some technique the player has never been
   * asked to know would also have found it.
   */
  maximumDifficulty?: Difficulty;
  /** Stops early once a step of this tier or harder has been applied. */
  stopOnceReaching?: Difficulty;
}

/** Guards against a technique that reports a finding it does not actually apply. */
const MAX_SOLVE_STEPS = 500;

function techniquesUpTo(ceiling: Difficulty | undefined): readonly RegisteredTechnique[] {
  if (ceiling === undefined) {
    return TECHNIQUE_LADDER;
  }
  return TECHNIQUE_LADDER.filter((technique) => isAtMostDifficulty(technique.tier, ceiling));
}

/**
 * Solves as far as the technique ladder allows, always applying the cheapest
 * technique that fires. That "cheapest first" rule is what makes the grade
 * meaningful — otherwise every puzzle would grade Master, since a forcing
 * chain can crack any of them.
 */
export function solveLogically(
  board: Board,
  options: LogicalSolveOptions = {},
): LogicalSolveOutcome {
  const workingBoard = cloneBoard(board);
  const availableTechniques = techniquesUpTo(options.maximumDifficulty);
  const steps: SolveStep[] = [];
  const techniqueCounts: Partial<Record<TechniqueId, number>> = {};
  let hardestTierUsed: Difficulty | null = null;

  for (let stepIndex = 0; stepIndex < MAX_SOLVE_STEPS; stepIndex += 1) {
    if (isBoardSolved(workingBoard)) {
      break;
    }

    let appliedTechnique: RegisteredTechnique | null = null;

    for (const technique of availableTechniques) {
      const result = technique.apply(workingBoard);
      if (result === null) {
        continue;
      }

      applyTechniqueResult(workingBoard, result);
      steps.push({
        technique: result.technique,
        placements: result.placements,
        eliminations: result.eliminations,
        explanation: result.explanation,
      });
      techniqueCounts[result.technique] = (techniqueCounts[result.technique] ?? 0) + 1;
      hardestTierUsed =
        hardestTierUsed === null
          ? technique.tier
          : harderDifficulty(hardestTierUsed, technique.tier);
      appliedTechnique = technique;
      break;
    }

    if (appliedTechnique === null) {
      break;
    }

    if (
      options.stopOnceReaching !== undefined &&
      hardestTierUsed !== null &&
      !isAtMostDifficulty(hardestTierUsed, options.stopOnceReaching)
    ) {
      break;
    }
  }

  return {
    solved: isBoardSolved(workingBoard),
    steps,
    techniqueCounts,
    hardestTierUsed,
  };
}

/**
 * The puzzle's tier, or null when the ladder cannot finish it without
 * guessing. A generated puzzle returning null is a bug, not a hard puzzle.
 */
export function gradePuzzle(board: Board): Difficulty | null {
  const outcome = solveLogically(board);
  if (!outcome.solved) {
    return null;
  }
  // A grid handed over already complete needed nothing; call it easy rather
  // than null, which is reserved for "the ladder got stuck".
  return outcome.hardestTierUsed ?? 'easy';
}

/**
 * The next step a hint should show. Capped at the puzzle's own tier so a hint
 * explains a technique the player is plausibly working with.
 */
export function findNextHint(
  board: Board,
  maximumDifficulty: Difficulty,
): SolveStep | null {
  for (const technique of techniquesUpTo(maximumDifficulty)) {
    const result = technique.apply(board);
    if (result !== null) {
      return {
        technique: result.technique,
        placements: result.placements,
        eliminations: result.eliminations,
        explanation: result.explanation,
      };
    }
  }
  return null;
}
