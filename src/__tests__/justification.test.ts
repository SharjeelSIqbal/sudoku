import { boardFromString, cloneBoard, countCandidates, placeDigit } from '../game/board';
import { boardForPuzzle, generatePuzzle } from '../game/generator';
import { judgePlacement } from '../game/justification';
import { findFirstSolution } from '../game/solver';
import { applyTechniqueResult } from '../game/techniques/apply';
import { TECHNIQUE_LADDER } from '../game/techniques/registry';
import { CELL_COUNT, EMPTY_CELL, type Digit } from '../game/types';
import { GOLDEN_PUZZLE_FIXTURES } from './fixtures/techniqueFixtures';

describe('judging a placement', () => {
  it('calls a naked single justified', () => {
    // A cell down to one candidate needed no reasoning beyond looking at it.
    const fixture = GOLDEN_PUZZLE_FIXTURES.find(
      (candidate) => candidate.difficulty === 'easy',
    )!;
    const board = boardFromString(fixture.givens);
    const solution = findFirstSolution(board)!;

    const nakedSingleCell = Array.from({ length: CELL_COUNT }, (_, index) => index).find(
      (cellIndex) =>
        board.digits[cellIndex] === EMPTY_CELL &&
        countCandidates(board.candidates[cellIndex]) === 1,
    );

    if (nakedSingleCell === undefined) {
      // Not every easy puzzle opens with one; nothing to assert here.
      return;
    }

    expect(
      judgePlacement(board, nakedSingleCell, solution[nakedSingleCell] as Digit, 'easy'),
    ).toBe('justified');
  });

  it('calls a placement in a cell with many candidates a guess', () => {
    const puzzle = generatePuzzle('judge-guess', 'expert');
    const board = boardForPuzzle(puzzle);

    const guessableCell = Array.from({ length: CELL_COUNT }, (_, index) => index).find(
      (cellIndex) =>
        board.digits[cellIndex] === EMPTY_CELL &&
        countCandidates(board.candidates[cellIndex]) >= 4 &&
        judgePlacement(board, cellIndex, puzzle.solution[cellIndex] as Digit, 'expert') ===
          'unjustified',
    );

    // The point of the guess penalty is that such cells exist at the start of
    // a hard puzzle; if none did, the judgement would be worthless.
    expect(guessableCell).toBeDefined();
  });

  it('refuses to judge a cell that is already filled', () => {
    const fixture = GOLDEN_PUZZLE_FIXTURES[0];
    const board = boardFromString(fixture.givens);
    const filledCell = Array.from({ length: CELL_COUNT }, (_, index) => index).find(
      (cellIndex) => board.digits[cellIndex] !== EMPTY_CELL,
    )!;

    expect(
      judgePlacement(board, filledCell, board.digits[filledCell] as Digit, 'easy'),
    ).toBe('unjustified');
  });

  it('must be given the board from before the move', () => {
    // Passing the post-move board would make every placement look justified,
    // because the digit is already sitting in the cell. Guard the contract.
    const puzzle = generatePuzzle('judge-premove', 'medium');
    const board = boardForPuzzle(puzzle);
    const emptyCell = Array.from({ length: CELL_COUNT }, (_, index) => index).find(
      (cellIndex) => board.digits[cellIndex] === EMPTY_CELL,
    )!;
    const digit = puzzle.solution[emptyCell] as Digit;

    const afterMove = cloneBoard(board);
    placeDigit(afterMove, emptyCell, digit);

    expect(judgePlacement(afterMove, emptyCell, digit, 'medium')).toBe('unjustified');
  });

  it('does not modify the board it is judging', () => {
    const puzzle = generatePuzzle('judge-immutable', 'hard');
    const board = boardForPuzzle(puzzle);
    const digitsBefore = [...board.digits];
    const candidatesBefore = [...board.candidates];

    const emptyCell = board.digits.findIndex((digit) => digit === EMPTY_CELL);
    judgePlacement(board, emptyCell, puzzle.solution[emptyCell] as Digit, 'hard');

    expect([...board.digits]).toEqual(digitsBefore);
    expect([...board.candidates]).toEqual(candidatesBefore);
  });
});

/**
 * The property that makes the penalty fair: anything the technique ladder
 * itself deduces, at or below the puzzle's tier, must be judged justified.
 * If this fails, players are being docked points for correct reasoning.
 */
describe('every logically deduced placement is judged justified', () => {
  it.each(GOLDEN_PUZZLE_FIXTURES.map((fixture) => [fixture.difficulty, fixture]))(
    'across the whole solve path of the frozen %s puzzle',
    (_difficulty, fixture) => {
      const board = boardFromString(fixture.givens);
      let placementsChecked = 0;

      for (let step = 0; step < 400; step += 1) {
        let appliedResult = null;

        for (const technique of TECHNIQUE_LADDER) {
          const result = technique.apply(cloneBoard(board));
          if (result !== null) {
            appliedResult = result;
            break;
          }
        }

        if (appliedResult === null) {
          break;
        }

        for (const placement of appliedResult.placements) {
          expect({
            cellIndex: placement.cellIndex,
            verdict: judgePlacement(
              board,
              placement.cellIndex,
              placement.digit,
              fixture.difficulty,
            ),
          }).toEqual({ cellIndex: placement.cellIndex, verdict: 'justified' });
          placementsChecked += 1;
        }

        applyTechniqueResult(board, appliedResult);
      }

      expect(placementsChecked).toBeGreaterThan(0);
    },
  );
});
