/**
 * The difficulty ladder.
 *
 * Order here is the whole grading model: the solver always applies the
 * cheapest technique that fires, and a puzzle's tier is the hardest rung its
 * logical path ever had to reach. Reordering this list re-grades every puzzle
 * in the bank, so the fixtures in `src/__tests__/fixtures` exist to make that
 * loud rather than silent.
 *
 * Adding a technique means: write it as a pure function, register it here at
 * the right cost, and add a positive and a negative fixture for it.
 */

import { type Difficulty, type Technique, type TechniqueId } from '../types';
import { findJellyfish, findSwordfish, findXWing } from './fish';
import { findForcingChain } from './forcingChain';
import { findHiddenPair, findHiddenQuad, findHiddenTriple } from './hiddenSubsets';
import { findClaimingCandidates, findPointingCandidates } from './lockedCandidates';
import { findNakedPair, findNakedQuad, findNakedTriple } from './nakedSubsets';
import { findSimpleColouring } from './simpleColouring';
import {
  findFullHouse,
  findHiddenSingleInBox,
  findHiddenSingleInLine,
  findNakedSingle,
} from './singles';
import { findUniqueRectangle } from './uniqueRectangle';
import { findWWing, findXyWing, findXyzWing } from './wings';

export interface RegisteredTechnique {
  id: TechniqueId;
  /** The tier a puzzle reaches by needing this technique. */
  tier: Difficulty;
  /** Human-facing name, used in hints and the stats screen. */
  label: string;
  /**
   * Whether the technique concludes by filling a cell or by ruling candidates
   * out. Callers that only want eliminations — move justification runs an
   * elimination-only pass — filter on this rather than calling the technique
   * and discarding a placement result. That distinction is not cosmetic:
   * `forcingChain` is orders of magnitude more expensive than everything else
   * on the ladder, and calling it only to throw the answer away dominated the
   * cost of judging a move.
   */
  deduces: 'placements' | 'eliminations';
  apply: Technique;
}

export const TECHNIQUE_LADDER: readonly RegisteredTechnique[] = [
  // easy — scanning only
  { id: 'fullHouse', tier: 'easy', label: 'Full house', deduces: 'placements', apply: findFullHouse },
  { id: 'nakedSingle', tier: 'easy', label: 'Naked single', deduces: 'placements', apply: findNakedSingle },
  {
    id: 'hiddenSingleBox',
    tier: 'easy',
    label: 'Hidden single (box)',
    deduces: 'placements',
    apply: findHiddenSingleInBox,
  },

  // medium — the first eliminations
  {
    id: 'hiddenSingleLine',
    tier: 'medium',
    label: 'Hidden single (line)',
    deduces: 'placements',
    apply: findHiddenSingleInLine,
  },
  {
    id: 'pointingCandidates',
    tier: 'medium',
    label: 'Pointing candidates',
    deduces: 'eliminations',
    apply: findPointingCandidates,
  },
  {
    id: 'claimingCandidates',
    tier: 'medium',
    label: 'Claiming candidates',
    deduces: 'eliminations',
    apply: findClaimingCandidates,
  },
  { id: 'nakedPair', tier: 'medium', label: 'Naked pair', deduces: 'eliminations', apply: findNakedPair },

  // hard — subsets
  { id: 'hiddenPair', tier: 'hard', label: 'Hidden pair', deduces: 'eliminations', apply: findHiddenPair },
  { id: 'nakedTriple', tier: 'hard', label: 'Naked triple', deduces: 'eliminations', apply: findNakedTriple },
  { id: 'hiddenTriple', tier: 'hard', label: 'Hidden triple', deduces: 'eliminations', apply: findHiddenTriple },
  { id: 'nakedQuad', tier: 'hard', label: 'Naked quad', deduces: 'eliminations', apply: findNakedQuad },
  { id: 'hiddenQuad', tier: 'hard', label: 'Hidden quad', deduces: 'eliminations', apply: findHiddenQuad },

  // expert — patterns spanning the grid
  { id: 'xWing', tier: 'expert', label: 'X-Wing', deduces: 'eliminations', apply: findXWing },
  {
    id: 'simpleColouring',
    tier: 'expert',
    label: 'Simple colouring',
    deduces: 'eliminations',
    apply: findSimpleColouring,
  },
  { id: 'xyWing', tier: 'expert', label: 'XY-Wing', deduces: 'eliminations', apply: findXyWing },

  // extreme — bigger fish and fussier wings
  { id: 'swordfish', tier: 'extreme', label: 'Swordfish', deduces: 'eliminations', apply: findSwordfish },
  { id: 'xyzWing', tier: 'extreme', label: 'XYZ-Wing', deduces: 'eliminations', apply: findXyzWing },
  { id: 'wWing', tier: 'extreme', label: 'W-Wing', deduces: 'eliminations', apply: findWWing },
  { id: 'jellyfish', tier: 'extreme', label: 'Jellyfish', deduces: 'eliminations', apply: findJellyfish },
  {
    id: 'uniqueRectangle',
    tier: 'extreme',
    label: 'Unique rectangle',
    deduces: 'eliminations',
    apply: findUniqueRectangle,
  },

  // master — reasoning by hypothesis
  {
    id: 'forcingChain',
    tier: 'master',
    label: 'Forcing chain',
    deduces: 'placements',
    apply: findForcingChain,
  },
];

const TECHNIQUE_BY_ID = new Map<TechniqueId, RegisteredTechnique>(
  TECHNIQUE_LADDER.map((technique) => [technique.id, technique]),
);

export function techniqueById(id: TechniqueId): RegisteredTechnique {
  const technique = TECHNIQUE_BY_ID.get(id);
  if (technique === undefined) {
    throw new Error(`No technique registered with id ${id}`);
  }
  return technique;
}

export function techniqueLabel(id: TechniqueId): string {
  return techniqueById(id).label;
}

export function techniqueTier(id: TechniqueId): Difficulty {
  return techniqueById(id).tier;
}
