import {
  AUTO_CANDIDATES_MULTIPLIER_CEILING,
  BASE_POINTS,
  PAR_SECONDS,
  SPEED_MULTIPLIER_MAXIMUM,
  SPEED_MULTIPLIER_MINIMUM,
  STREAK_MULTIPLIER_MAXIMUM,
  computeScore,
  penaltyPointsFor,
  speedMultiplierFor,
  streakMultiplierFor,
  type ScoreInput,
} from '../game/scoring';
import { DIFFICULTIES } from '../game/types';

function baseInput(overrides: Partial<ScoreInput> = {}): ScoreInput {
  return {
    difficulty: 'medium',
    mode: 'ranked',
    completed: true,
    elapsedSeconds: PAR_SECONDS.medium,
    wrongEntryCount: 0,
    repeatedWrongEntryCount: 0,
    unjustifiedPlacementCount: 0,
    hintCount: 0,
    instantValidationEnabled: true,
    strikeLimitEnabled: false,
    autoCandidatesUsed: false,
    currentStreakDays: 0,
    ...overrides,
  };
}

describe('base points', () => {
  it('rises with every tier', () => {
    const points = DIFFICULTIES.map((difficulty) => BASE_POINTS[difficulty]);
    for (let index = 1; index < points.length; index += 1) {
      expect(points[index]).toBeGreaterThan(points[index - 1]);
    }
  });

  it('makes one master solve worth many easy ones', () => {
    // Otherwise grinding the bottom of the ladder becomes the efficient play.
    expect(BASE_POINTS.master).toBeGreaterThanOrEqual(BASE_POINTS.easy * 10);
  });

  it('gives every tier a par time that rises with difficulty', () => {
    const pars = DIFFICULTIES.map((difficulty) => PAR_SECONDS[difficulty]);
    for (let index = 1; index < pars.length; index += 1) {
      expect(pars[index]).toBeGreaterThan(pars[index - 1]);
    }
  });
});

describe('speed multiplier', () => {
  it('gives the full bonus at or under half par', () => {
    expect(speedMultiplierFor('medium', PAR_SECONDS.medium * 0.5)).toBe(
      SPEED_MULTIPLIER_MAXIMUM,
    );
    expect(speedMultiplierFor('medium', 1)).toBe(SPEED_MULTIPLIER_MAXIMUM);
  });

  it('gives no bonus at or over twice par', () => {
    expect(speedMultiplierFor('medium', PAR_SECONDS.medium * 2)).toBe(
      SPEED_MULTIPLIER_MINIMUM,
    );
    expect(speedMultiplierFor('medium', PAR_SECONDS.medium * 10)).toBe(
      SPEED_MULTIPLIER_MINIMUM,
    );
  });

  it('slides between the two, never outside them', () => {
    const atPar = speedMultiplierFor('medium', PAR_SECONDS.medium);
    expect(atPar).toBeGreaterThan(SPEED_MULTIPLIER_MINIMUM);
    expect(atPar).toBeLessThan(SPEED_MULTIPLIER_MAXIMUM);
  });

  it('scales par by tier, so a slow master solve still beats par', () => {
    const seconds = PAR_SECONDS.easy * 2;
    expect(speedMultiplierFor('easy', seconds)).toBe(SPEED_MULTIPLIER_MINIMUM);
    expect(speedMultiplierFor('master', seconds)).toBe(SPEED_MULTIPLIER_MAXIMUM);
  });
});

describe('streak multiplier', () => {
  it('starts at one and grows with the streak', () => {
    expect(streakMultiplierFor(0)).toBe(1);
    expect(streakMultiplierFor(10)).toBeGreaterThan(streakMultiplierFor(5));
  });

  it('is capped, so a long streak cannot run away with the scoreboard', () => {
    expect(streakMultiplierFor(10000)).toBe(STREAK_MULTIPLIER_MAXIMUM);
  });
});

describe('penalties', () => {
  it('charges nothing for a clean game', () => {
    expect(penaltyPointsFor(baseInput())).toBe(0);
  });

  it('charges most for a hint and least for a lucky guess', () => {
    const hintCost = penaltyPointsFor(baseInput({ hintCount: 1 }));
    const wrongCost = penaltyPointsFor(baseInput({ wrongEntryCount: 1 }));
    const guessCost = penaltyPointsFor(baseInput({ unjustifiedPlacementCount: 1 }));

    expect(hintCost).toBeGreaterThan(wrongCost);
    expect(wrongCost).toBeGreaterThan(guessCost);
    expect(guessCost).toBeGreaterThan(0);
  });

  it('punishes cycling a cell through the digits', () => {
    const once = penaltyPointsFor(baseInput({ wrongEntryCount: 1 }));
    const repeatedly = penaltyPointsFor(
      baseInput({ wrongEntryCount: 4, repeatedWrongEntryCount: 3 }),
    );
    expect(repeatedly).toBeGreaterThan(once * 4);
  });

  it('scales with the tier, so a mistake costs proportionally the same', () => {
    const easyCost = penaltyPointsFor(baseInput({ difficulty: 'easy', wrongEntryCount: 1 }));
    const masterCost = penaltyPointsFor(
      baseInput({ difficulty: 'master', wrongEntryCount: 1 }),
    );
    expect(masterCost).toBeGreaterThan(easyCost);
  });
});

describe('computed score', () => {
  it('awards nothing in zen mode, by design', () => {
    expect(computeScore(baseInput({ mode: 'zen' })).finalPoints).toBe(0);
  });

  it('awards nothing for an unfinished game', () => {
    expect(computeScore(baseInput({ completed: false })).finalPoints).toBe(0);
  });

  it('awards more for a harder tier, all else equal', () => {
    const easy = computeScore(
      baseInput({ difficulty: 'easy', elapsedSeconds: PAR_SECONDS.easy }),
    );
    const master = computeScore(
      baseInput({ difficulty: 'master', elapsedSeconds: PAR_SECONDS.master }),
    );
    expect(master.finalPoints).toBeGreaterThan(easy.finalPoints);
  });

  it('rewards a flawless run over a sloppy one', () => {
    const flawless = computeScore(baseInput());
    const sloppy = computeScore(baseInput({ wrongEntryCount: 3 }));
    expect(flawless.finalPoints).toBeGreaterThan(sloppy.finalPoints);
  });

  it('rewards the hard-mode toggles', () => {
    const plain = computeScore(baseInput());
    const validationOff = computeScore(baseInput({ instantValidationEnabled: false }));
    const strikeLimit = computeScore(baseInput({ strikeLimitEnabled: true }));

    expect(validationOff.finalPoints).toBeGreaterThan(plain.finalPoints);
    expect(strikeLimit.finalPoints).toBeGreaterThan(plain.finalPoints);
  });

  it('docks a lucky guess without wiping the score', () => {
    const clean = computeScore(baseInput());
    const lucky = computeScore(baseInput({ unjustifiedPlacementCount: 5 }));

    expect(lucky.finalPoints).toBeLessThan(clean.finalPoints);
    expect(lucky.finalPoints).toBeGreaterThan(0);
  });

  it('caps the multiplier when auto-candidates did the bookkeeping', () => {
    const byHand = computeScore(baseInput({ elapsedSeconds: 1, currentStreakDays: 30 }));
    const assisted = computeScore(
      baseInput({ elapsedSeconds: 1, currentStreakDays: 30, autoCandidatesUsed: true }),
    );

    expect(byHand.totalMultiplier).toBeGreaterThan(AUTO_CANDIDATES_MULTIPLIER_CEILING);
    expect(assisted.totalMultiplier).toBe(AUTO_CANDIDATES_MULTIPLIER_CEILING);
    expect(assisted.finalPoints).toBeLessThan(byHand.finalPoints);
  });

  it('never goes negative, however badly the game went', () => {
    const disastrous = computeScore(
      baseInput({
        wrongEntryCount: 50,
        repeatedWrongEntryCount: 40,
        hintCount: 30,
        unjustifiedPlacementCount: 20,
      }),
    );
    expect(disastrous.finalPoints).toBe(0);
  });

  it('reports a breakdown that explains the final number', () => {
    const breakdown = computeScore(baseInput({ currentStreakDays: 3 }));
    expect(breakdown.basePoints).toBe(BASE_POINTS.medium);
    expect(breakdown.totalMultiplier).toBeCloseTo(
      breakdown.speedMultiplier * breakdown.bonusMultiplier * breakdown.streakMultiplier,
      6,
    );
  });
});
