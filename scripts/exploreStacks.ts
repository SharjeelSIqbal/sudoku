/**
 * Research script for the Perfect Sudoku mode. Not shipped, not imported.
 *
 * Question it answers: can we build nine sudoku layers where every pillar (the
 * nine cells at one row/column position, running back through the layers)
 * holds each digit exactly once — and crucially, are the resulting stacks
 * *non-degenerate*?
 *
 * Two constructions are known to work on paper and both are useless as
 * puzzles:
 *
 *   - Relabelling: layer k is layer 0 with every digit shifted by k.
 *   - Row cycling: layer k is layer 0 with rows permuted within and across
 *     bands (the group Z3 x Z3 acting on rows is fixed-point free and
 *     preserves sudoku validity, and sweeps each pillar through a whole
 *     column of the base grid).
 *
 * Both satisfy every rule of the mode, and both collapse the moment a player
 * notices: solve one layer and the other eight fill in mechanically. So the
 * real question is whether stacks exist that are *not* related by any
 * transformation a person would spot.
 *
 * Run: npx tsx scripts/exploreStacks.ts
 */

import {
  ALL_CANDIDATES_MASK,
  BOX_OF_CELL,
  COLUMN_OF_CELL,
  ROW_OF_CELL,
  countCandidates,
  maskOfDigit,
} from '../src/game/board';
import { createRandomNumberGenerator, type RandomNumberGenerator } from '../src/game/rng';
import { ALL_DIGITS, BOARD_SIZE, CELL_COUNT, EMPTY_CELL, type Digit } from '../src/game/types';

/** Layer counts to measure. Nine is the mode's headline; the rest are the ladder. */
const LAYER_COUNTS = [2, 3, 4, 5, 6, 7, 8, 9];
const STACKS_PER_LAYER_COUNT = 5;
/** Re-randomisations of a single layer before giving up on the whole stack. */
const RETRIES_PER_LAYER = 25;
/** Wall-clock ceiling per stack, so a hopeless layer count reports rather than hangs. */
const STACK_TIME_BUDGET_MS = 20000;

type Grid = Uint8Array;

/**
 * Builds one solved sudoku whose cells avoid the digits already used in their
 * pillar. This is the ordinary backtracking solver plus a per-cell mask of
 * digits the pillar has spent.
 */
function solveAvoiding(
  forbiddenPerCell: Uint16Array,
  random: RandomNumberGenerator,
): Grid | null {
  const digits = new Uint8Array(CELL_COUNT);
  const usedInRow = new Uint16Array(BOARD_SIZE);
  const usedInColumn = new Uint16Array(BOARD_SIZE);
  const usedInBox = new Uint16Array(BOARD_SIZE);
  const digitOrder = random.shuffled(ALL_DIGITS);

  const availableMask = (cellIndex: number): number =>
    ALL_CANDIDATES_MASK &
    ~forbiddenPerCell[cellIndex] &
    ~(
      usedInRow[ROW_OF_CELL[cellIndex]] |
      usedInColumn[COLUMN_OF_CELL[cellIndex]] |
      usedInBox[BOX_OF_CELL[cellIndex]]
    );

  const search = (): boolean => {
    let bestCell = -1;
    let bestCount = BOARD_SIZE + 1;

    for (let cellIndex = 0; cellIndex < CELL_COUNT; cellIndex += 1) {
      if (digits[cellIndex] !== EMPTY_CELL) {
        continue;
      }
      const optionCount = countCandidates(availableMask(cellIndex));
      if (optionCount === 0) {
        return false;
      }
      if (optionCount < bestCount) {
        bestCount = optionCount;
        bestCell = cellIndex;
        if (optionCount === 1) {
          break;
        }
      }
    }

    if (bestCell === -1) {
      return true;
    }

    const mask = availableMask(bestCell);
    const rowIndex = ROW_OF_CELL[bestCell];
    const columnIndex = COLUMN_OF_CELL[bestCell];
    const boxIndex = BOX_OF_CELL[bestCell];

    for (const digit of digitOrder) {
      const digitMask = maskOfDigit(digit);
      if ((mask & digitMask) === 0) {
        continue;
      }

      digits[bestCell] = digit;
      usedInRow[rowIndex] |= digitMask;
      usedInColumn[columnIndex] |= digitMask;
      usedInBox[boxIndex] |= digitMask;

      if (search()) {
        return true;
      }

      digits[bestCell] = EMPTY_CELL;
      usedInRow[rowIndex] &= ~digitMask;
      usedInColumn[columnIndex] &= ~digitMask;
      usedInBox[boxIndex] &= ~digitMask;
    }

    return false;
  };

  return search() ? digits : null;
}

/**
 * Builds `layerCount` layers, each avoiding the digits its pillar has spent.
 *
 * Retries an individual layer rather than discarding the stack: the late
 * layers are the constrained ones, and throwing away eight good layers because
 * the ninth was unlucky is what made the first version of this script hang.
 */
function buildStack(
  layerCount: number,
  seedPrefix: string,
  deadline: number,
): Grid[] | null {
  const pillarUsed = new Uint16Array(CELL_COUNT);
  const layers: Grid[] = [];

  for (let layerIndex = 0; layerIndex < layerCount; layerIndex += 1) {
    let layer: Grid | null = null;

    for (let retry = 0; retry < RETRIES_PER_LAYER && layer === null; retry += 1) {
      if (Date.now() > deadline) {
        return null;
      }
      layer = solveAvoiding(
        pillarUsed,
        createRandomNumberGenerator(`${seedPrefix}-L${layerIndex}-${retry}`),
      );
    }

    if (layer === null) {
      return null;
    }

    for (let cellIndex = 0; cellIndex < CELL_COUNT; cellIndex += 1) {
      pillarUsed[cellIndex] |= maskOfDigit(layer[cellIndex] as Digit);
    }
    layers.push(layer);
  }

  return layers;
}

function isValidSudoku(grid: Grid): boolean {
  const unitsSeen = [
    new Uint16Array(BOARD_SIZE),
    new Uint16Array(BOARD_SIZE),
    new Uint16Array(BOARD_SIZE),
  ];

  for (let cellIndex = 0; cellIndex < CELL_COUNT; cellIndex += 1) {
    const digitMask = maskOfDigit(grid[cellIndex] as Digit);
    const unitIndexes = [
      ROW_OF_CELL[cellIndex],
      COLUMN_OF_CELL[cellIndex],
      BOX_OF_CELL[cellIndex],
    ];
    for (let unitKind = 0; unitKind < 3; unitKind += 1) {
      if ((unitsSeen[unitKind][unitIndexes[unitKind]] & digitMask) !== 0) {
        return false;
      }
      unitsSeen[unitKind][unitIndexes[unitKind]] |= digitMask;
    }
  }

  return true;
}

/**
 * Every pillar holds distinct digits. At nine layers that means all nine are
 * present; below nine it is simply an all-different constraint — which is why
 * fewer layers never force a cell for free.
 */
function pillarsAreDistinct(layers: Grid[]): boolean {
  for (let cellIndex = 0; cellIndex < CELL_COUNT; cellIndex += 1) {
    let seen = 0;
    for (const layer of layers) {
      const digitMask = maskOfDigit(layer[cellIndex] as Digit);
      if ((seen & digitMask) !== 0) {
        return false;
      }
      seen |= digitMask;
    }
    if (layers.length === BOARD_SIZE && seen !== ALL_CANDIDATES_MASK) {
      return false;
    }
  }
  return true;
}

/** True when `second` is `first` with the digits renamed — the obvious tell. */
function isRelabelling(first: Grid, second: Grid): boolean {
  const forward = new Map<number, number>();
  const backward = new Map<number, number>();

  for (let cellIndex = 0; cellIndex < CELL_COUNT; cellIndex += 1) {
    const from = first[cellIndex];
    const to = second[cellIndex];
    if (forward.has(from) && forward.get(from) !== to) {
      return false;
    }
    if (backward.has(to) && backward.get(to) !== from) {
      return false;
    }
    forward.set(from, to);
    backward.set(to, from);
  }

  return true;
}

function lineOf(grid: Grid, index: number, isRow: boolean): string {
  const values: number[] = [];
  for (let offset = 0; offset < BOARD_SIZE; offset += 1) {
    values.push(isRow ? grid[index * BOARD_SIZE + offset] : grid[offset * BOARD_SIZE + index]);
  }
  return values.join('');
}

/** True when `second` is `first` with whole rows (or columns) shuffled. */
function isLinePermutation(first: Grid, second: Grid, isRow: boolean): boolean {
  const firstLines = new Set<string>();
  for (let index = 0; index < BOARD_SIZE; index += 1) {
    firstLines.add(lineOf(first, index, isRow));
  }
  if (firstLines.size !== BOARD_SIZE) {
    return false;
  }
  for (let index = 0; index < BOARD_SIZE; index += 1) {
    if (!firstLines.has(lineOf(second, index, isRow))) {
      return false;
    }
  }
  return true;
}

function describeRelation(first: Grid, second: Grid): string | null {
  if (isRelabelling(first, second)) {
    return 'relabelling';
  }
  if (isLinePermutation(first, second, true)) {
    return 'row permutation';
  }
  if (isLinePermutation(first, second, false)) {
    return 'column permutation';
  }
  return null;
}

process.stdout.write('layers  built  avg build   clean stacks  related pairs\n');
process.stdout.write('------  -----  ---------   ------------  -------------\n');

for (const layerCount of LAYER_COUNTS) {
  let stacksBuilt = 0;
  let cleanStacks = 0;
  let totalMilliseconds = 0;
  const relationTally = new Map<string, number>();

  for (let attempt = 0; attempt < STACKS_PER_LAYER_COUNT; attempt += 1) {
    const startedAt = Date.now();
    const layers = buildStack(
      layerCount,
      `stack-${layerCount}-${attempt}`,
      startedAt + STACK_TIME_BUDGET_MS,
    );
    totalMilliseconds += Date.now() - startedAt;

    if (layers === null) {
      continue;
    }

    if (!layers.every(isValidSudoku)) {
      throw new Error(`A ${layerCount}-layer stack produced an invalid layer`);
    }
    if (!pillarsAreDistinct(layers)) {
      throw new Error(`A ${layerCount}-layer stack has a repeated digit in a pillar`);
    }

    stacksBuilt += 1;

    let relatedInThisStack = 0;
    for (let first = 0; first < layerCount; first += 1) {
      for (let second = first + 1; second < layerCount; second += 1) {
        const relation = describeRelation(layers[first], layers[second]);
        if (relation !== null) {
          relatedInThisStack += 1;
          relationTally.set(relation, (relationTally.get(relation) ?? 0) + 1);
        }
      }
    }

    if (relatedInThisStack === 0) {
      cleanStacks += 1;
    }
  }

  const relationSummary =
    relationTally.size === 0
      ? 'none'
      : [...relationTally].map(([name, count]) => `${count} ${name}`).join(', ');

  process.stdout.write(
    `${`${layerCount}`.padEnd(8)}${`${stacksBuilt}/${STACKS_PER_LAYER_COUNT}`.padEnd(7)}` +
      `${`${Math.round(totalMilliseconds / STACKS_PER_LAYER_COUNT)}ms`.padEnd(12)}` +
      `${`${cleanStacks}`.padEnd(14)}${relationSummary}\n`,
  );
}

process.stdout.write(
  '\n"clean" means no two layers in the stack are related by a relabelling\n' +
    'or a whole-row/column shuffle — the relations a player could actually spot.\n',
);

/**
 * Control group.
 *
 * Two stacks that are known to be degenerate, built deliberately. They exist to
 * prove the mode is possible at nine layers *and* to prove the relation
 * detector actually fires — a detector that never triggered would report every
 * stack as clean, and the sweep above would be worthless.
 */
function buildRelabellingStack(base: Grid): Grid[] {
  return Array.from({ length: BOARD_SIZE }, (_, shift) => {
    const layer = new Uint8Array(CELL_COUNT);
    for (let cellIndex = 0; cellIndex < CELL_COUNT; cellIndex += 1) {
      layer[cellIndex] = ((base[cellIndex] - 1 + shift) % BOARD_SIZE) + 1;
    }
    return layer;
  });
}

/**
 * Layer (i, j) shifts rows by j within their band and bands by i. Those two
 * shifts generate a group of order nine acting without fixed points, and each
 * pillar therefore sweeps a whole column of the base grid — nine distinct
 * digits, exactly what the mode requires.
 */
function buildRowCyclingStack(base: Grid): Grid[] {
  const layers: Grid[] = [];

  for (let bandShift = 0; bandShift < 3; bandShift += 1) {
    for (let rowShift = 0; rowShift < 3; rowShift += 1) {
      const layer = new Uint8Array(CELL_COUNT);
      for (let rowIndex = 0; rowIndex < BOARD_SIZE; rowIndex += 1) {
        const band = Math.floor(rowIndex / 3);
        const rowWithinBand = rowIndex % 3;
        const sourceRow =
          ((band + bandShift) % 3) * 3 + ((rowWithinBand + rowShift) % 3);
        for (let columnIndex = 0; columnIndex < BOARD_SIZE; columnIndex += 1) {
          layer[rowIndex * BOARD_SIZE + columnIndex] =
            base[sourceRow * BOARD_SIZE + columnIndex];
        }
      }
      layers.push(layer);
    }
  }

  return layers;
}

const baseGrid = solveAvoiding(
  new Uint16Array(CELL_COUNT),
  createRandomNumberGenerator('control-base'),
);

if (baseGrid === null) {
  throw new Error('Could not build a base grid for the control stacks');
}

process.stdout.write('\ncontrol stacks (known degenerate, nine layers)\n');
process.stdout.write('---------------------------------------------\n');

for (const [name, stack] of [
  ['relabelling', buildRelabellingStack(baseGrid)],
  ['row cycling', buildRowCyclingStack(baseGrid)],
] as const) {
  const everyLayerValid = stack.every(isValidSudoku);
  const pillarsOk = pillarsAreDistinct(stack);

  let related = 0;
  let totalPairs = 0;
  for (let first = 0; first < stack.length; first += 1) {
    for (let second = first + 1; second < stack.length; second += 1) {
      totalPairs += 1;
      if (describeRelation(stack[first], stack[second]) !== null) {
        related += 1;
      }
    }
  }

  process.stdout.write(
    `${name.padEnd(14)}valid layers: ${everyLayerValid}  perfect pillars: ${pillarsOk}  ` +
      `pairs flagged: ${related}/${totalPairs}\n`,
  );
}
