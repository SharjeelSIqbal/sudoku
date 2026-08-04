/**
 * Getting a puzzle onto the screen without janking.
 *
 * Generation costs many solver runs, so it never happens inside `onPress`. The
 * bank is popped synchronously if it has anything; only a cold or drained bank
 * falls through to generating, and that path reports `isGenerating` so the
 * screen can show an honest spinner rather than freezing on the tap.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { InteractionManager } from 'react-native';

import { generateDailyPuzzle, generatePuzzle } from '../game/generator';
import { DIFFICULTIES, type Difficulty } from '../game/types';
import { takeBankedPuzzle, topUpBank } from '../data/puzzleBank';

export interface LoadedPuzzle {
  seed: string;
  difficulty: Difficulty;
  givens: Uint8Array;
  solution: Uint8Array;
}

export function usePuzzleLoader() {
  const [isGenerating, setIsGenerating] = useState(false);
  const topUpScheduled = useRef(false);

  /** Refills the bank after the interaction that emptied it has finished. */
  const scheduleTopUp = useCallback(() => {
    if (topUpScheduled.current) {
      return;
    }
    topUpScheduled.current = true;

    InteractionManager.runAfterInteractions(() => {
      void topUpBank(DIFFICULTIES, `bank-${Date.now()}`)
        .catch((error) => {
          console.warn('Could not top up the puzzle bank', error);
        })
        .finally(() => {
          topUpScheduled.current = false;
        });
    });
  }, []);

  useEffect(() => {
    // Warm the bank on first mount so the very first tap is instant too.
    scheduleTopUp();
  }, [scheduleTopUp]);

  const loadPuzzle = useCallback(
    async (difficulty: Difficulty): Promise<LoadedPuzzle> => {
      const banked = await takeBankedPuzzle(difficulty);
      if (banked !== null) {
        scheduleTopUp();
        return {
          seed: banked.seed,
          difficulty: banked.difficulty,
          givens: banked.givens,
          solution: banked.solution,
        };
      }

      setIsGenerating(true);
      try {
        const generated = generatePuzzle(`live-${difficulty}-${Date.now()}`, difficulty);
        return {
          seed: generated.seed,
          difficulty,
          givens: generated.givens,
          solution: generated.solution,
        };
      } finally {
        setIsGenerating(false);
        scheduleTopUp();
      }
    },
    [scheduleTopUp],
  );

  /**
   * The daily challenge is generated rather than banked: its seed comes from
   * the date, so every install must produce that exact puzzle and a banked
   * substitute would be a different grid.
   */
  const loadDailyPuzzle = useCallback(
    async (difficulty: Difficulty): Promise<LoadedPuzzle> => {
      setIsGenerating(true);
      try {
        const generated = generateDailyPuzzle(new Date(), difficulty);
        return {
          seed: generated.seed,
          difficulty,
          givens: generated.givens,
          solution: generated.solution,
        };
      } finally {
        setIsGenerating(false);
      }
    },
    [],
  );

  return { loadPuzzle, loadDailyPuzzle, isGenerating };
}
