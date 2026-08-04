import { boardFromString } from '../game/board';
import { BOARD_SIZE, CELL_COUNT, EMPTY_CELL } from '../game/types';
import {
  BOARD_BORDER_WIDTH,
  boardLayoutFor,
  describeCellForScreenReader,
  type CellContents,
} from '../screens/play/game/components/SudokuBoard';
import { GOLDEN_PUZZLE_FIXTURES } from './fixtures/techniqueFixtures';

/**
 * Regression: the grid container carries a 2pt outer border, and React Native
 * lays borders out inside the box. A container sized at exactly `cellSize * 9`
 * left four points too little room, so the ninth cell of every row wrapped
 * onto the next line and the grid sheared by one more cell per row.
 *
 * It still looked like a 9x9 board. What gave it away on device was a blank
 * gutter down the right-hand side, and a peer highlight that came out as a
 * diagonal instead of a row, column and box.
 */
describe('board layout', () => {
  const AVAILABLE_SIZES = [200, 320, 360, 390, 414, 480, 768];

  it.each(AVAILABLE_SIZES)('fits nine cells inside the border at %ipt', (availableSize) => {
    const { cellSize, containerSize } = boardLayoutFor(availableSize);
    const usableWidth = containerSize - BOARD_BORDER_WIDTH * 2;

    expect(usableWidth).toBeGreaterThanOrEqual(cellSize * BOARD_SIZE);
  });

  it.each(AVAILABLE_SIZES)('leaves no unusable slack at %ipt', (availableSize) => {
    // Slack would show as a gap between the last column and the border.
    const { cellSize, containerSize } = boardLayoutFor(availableSize);
    expect(containerSize - BOARD_BORDER_WIDTH * 2).toBe(cellSize * BOARD_SIZE);
  });

  it.each(AVAILABLE_SIZES)('never overflows what it was given at %ipt', (availableSize) => {
    // The container may be up to two borders wider than the space offered;
    // more than that and the board would be clipped on a small screen.
    const { containerSize } = boardLayoutFor(availableSize);
    expect(containerSize).toBeLessThanOrEqual(availableSize + BOARD_BORDER_WIDTH * 2);
  });

  it('uses whole-point cells so rows cannot drift out of alignment', () => {
    for (const availableSize of AVAILABLE_SIZES) {
      expect(Number.isInteger(boardLayoutFor(availableSize).cellSize)).toBe(true);
    }
  });

  it('grows the cell size with the space available', () => {
    expect(boardLayoutFor(480).cellSize).toBeGreaterThan(boardLayoutFor(320).cellSize);
  });
});

function buildGame(overrides: Partial<CellContents> = {}): CellContents {
  const fixture = GOLDEN_PUZZLE_FIXTURES[0];
  return {
    givens: boardFromString(fixture.givens).digits,
    entries: new Uint8Array(CELL_COUNT),
    pencilMarks: new Uint16Array(CELL_COUNT),
    ...overrides,
  };
}

const NEUTRAL_STATE = {
  isGiven: false,
  isSelected: false,
  isPeer: false,
  isSameDigit: false,
  isConflicted: false,
  isHinted: false,
};

/**
 * A 9x9 grid is eighty-one unlabelled squares to a screen reader, so every
 * cell announces where it is and what it holds.
 */
describe('what the board tells a screen reader', () => {
  it('names the row and column of every cell', () => {
    const game = buildGame();
    for (let cellIndex = 0; cellIndex < CELL_COUNT; cellIndex += 1) {
      const label = describeCellForScreenReader(game, cellIndex, NEUTRAL_STATE);
      expect(label).toMatch(/^Row [1-9], column [1-9]/);
    }
  });

  it('numbers rows and columns from one, the way a person would', () => {
    const game = buildGame();
    expect(describeCellForScreenReader(game, 0, NEUTRAL_STATE)).toMatch(
      /^Row 1, column 1/,
    );
    expect(describeCellForScreenReader(game, CELL_COUNT - 1, NEUTRAL_STATE)).toMatch(
      /^Row 9, column 9/,
    );
    expect(describeCellForScreenReader(game, 9, NEUTRAL_STATE)).toMatch(
      /^Row 2, column 1/,
    );
  });

  it('says when a cell is empty', () => {
    const game = buildGame();
    const emptyCell = [...game.givens].findIndex((digit) => digit === EMPTY_CELL);
    expect(describeCellForScreenReader(game, emptyCell, NEUTRAL_STATE)).toMatch(
      /empty$/,
    );
  });

  it('marks a clue as given, so it is clear it cannot be changed', () => {
    const game = buildGame();
    const givenCell = [...game.givens].findIndex((digit) => digit !== EMPTY_CELL);
    expect(
      describeCellForScreenReader(game, givenCell, { ...NEUTRAL_STATE, isGiven: true }),
    ).toMatch(/given$/);
  });

  it('reads out pencil marks', () => {
    const game = buildGame();
    const emptyCell = [...game.givens].findIndex((digit) => digit === EMPTY_CELL);
    // Marks for 1 and 4.
    game.pencilMarks[emptyCell] = (1 << 0) | (1 << 3);

    expect(describeCellForScreenReader(game, emptyCell, NEUTRAL_STATE)).toMatch(
      /empty, pencil marks 1, 4$/,
    );
  });

  /**
   * With instant validation off the display deliberately withholds wrongness.
   * The screen reader has to withhold it too — otherwise a VoiceOver user gets
   * an easier game than everyone else, which is the opposite of the intent.
   */
  it('says "incorrect" only when the board is showing the mistake', () => {
    const game = buildGame();
    const emptyCell = [...game.givens].findIndex((digit) => digit === EMPTY_CELL);
    game.entries[emptyCell] = 5;

    expect(
      describeCellForScreenReader(game, emptyCell, {
        ...NEUTRAL_STATE,
        isConflicted: true,
      }),
    ).toMatch(/incorrect$/);

    expect(
      describeCellForScreenReader(game, emptyCell, {
        ...NEUTRAL_STATE,
        isConflicted: false,
      }),
    ).not.toMatch(/incorrect/);
  });

  it('reads the digit a player entered', () => {
    const game = buildGame();
    const emptyCell = [...game.givens].findIndex((digit) => digit === EMPTY_CELL);
    game.entries[emptyCell] = 7;

    expect(describeCellForScreenReader(game, emptyCell, NEUTRAL_STATE)).toMatch(/, 7$/);
  });
});
