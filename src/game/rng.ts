/**
 * Seeded pseudo-random number generation.
 *
 * `Math.random()` is banned everywhere in `src/game`. Two things depend on it:
 * generation being reproducible from a seed (so a bug in a puzzle can be
 * reported and replayed), and the daily challenge being identical on every
 * install without a server to hand the same puzzle out.
 */

/** Mixes a string seed into four 32-bit words (cyrb128). */
function hashSeedToWords(seed: string): [number, number, number, number] {
  let accumulatorOne = 1779033703;
  let accumulatorTwo = 3144134277;
  let accumulatorThree = 1013904242;
  let accumulatorFour = 2773480762;

  for (let i = 0; i < seed.length; i += 1) {
    const character = seed.charCodeAt(i);
    accumulatorOne = accumulatorTwo ^ Math.imul(accumulatorOne ^ character, 597399067);
    accumulatorTwo = accumulatorThree ^ Math.imul(accumulatorTwo ^ character, 2869860233);
    accumulatorThree = accumulatorFour ^ Math.imul(accumulatorThree ^ character, 951274213);
    accumulatorFour = accumulatorOne ^ Math.imul(accumulatorFour ^ character, 2716044179);
  }

  return [
    (accumulatorThree ^ accumulatorFour ^ Math.imul(accumulatorOne, 2246822507)) >>> 0,
    (accumulatorFour ^ accumulatorTwo ^ Math.imul(accumulatorTwo, 3266489909)) >>> 0,
    (accumulatorOne ^ accumulatorFour ^ Math.imul(accumulatorThree, 668265295)) >>> 0,
    (accumulatorTwo ^ accumulatorThree ^ Math.imul(accumulatorFour, 374761393)) >>> 0,
  ];
}

export interface RandomNumberGenerator {
  /** A float in [0, 1). */
  nextFloat(): number;
  /** An integer in [0, maxExclusive). */
  nextInt(maxExclusive: number): number;
  /** Returns a new array holding the items in a shuffled order. */
  shuffled<ItemType>(items: readonly ItemType[]): ItemType[];
}

/**
 * sfc32, seeded from a string. Fast, tiny state, and good enough statistically
 * for puzzle generation — this is not a cryptographic generator and must never
 * be used as one.
 */
export function createRandomNumberGenerator(seed: string): RandomNumberGenerator {
  const [initialA, initialB, initialC, initialD] = hashSeedToWords(seed);
  let stateA = initialA;
  let stateB = initialB;
  let stateC = initialC;
  let stateD = initialD;

  const nextFloat = (): number => {
    stateA >>>= 0;
    stateB >>>= 0;
    stateC >>>= 0;
    stateD >>>= 0;
    let result = (stateA + stateB) | 0;
    stateA = stateB ^ (stateB >>> 9);
    stateB = (stateC + (stateC << 3)) | 0;
    stateC = (stateC << 21) | (stateC >>> 11);
    stateD = (stateD + 1) | 0;
    result = (result + stateD) | 0;
    stateC = (stateC + result) | 0;
    return (result >>> 0) / 4294967296;
  };

  const nextInt = (maxExclusive: number): number =>
    Math.floor(nextFloat() * maxExclusive);

  const shuffled = <ItemType,>(items: readonly ItemType[]): ItemType[] => {
    const result = [...items];
    for (let i = result.length - 1; i > 0; i -= 1) {
      const swapIndex = nextInt(i + 1);
      const held = result[i];
      result[i] = result[swapIndex];
      result[swapIndex] = held;
    }
    return result;
  };

  return { nextFloat, nextInt, shuffled };
}

/**
 * The seed for a date's daily challenge. Uses the UTC calendar date so the
 * puzzle rolls over at the same instant everywhere and a player crossing a
 * timezone does not get two "todays" or skip one.
 */
export function seedFromDate(date: Date): string {
  const year = date.getUTCFullYear();
  const month = `${date.getUTCMonth() + 1}`.padStart(2, '0');
  const dayOfMonth = `${date.getUTCDate()}`.padStart(2, '0');
  return `daily-${year}-${month}-${dayOfMonth}`;
}
