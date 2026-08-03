# Sudoku

An offline Sudoku game for iOS — React Native (Expo SDK 57) + TypeScript.

Puzzles are generated on device and graded by the human solving techniques
their logical path requires, across six tiers: easy, medium, hard, expert,
extreme, master. There is no backend, no account, and no network call: the app
opens straight into a playable board and works in airplane mode.

## Features

- **Infinite puzzles.** Seeded on-device generation, every puzzle verified to
  have exactly one solution and to be solvable without guessing.
- **Daily challenge.** The seed derives from the date, so every install gets
  the same puzzle each day with nothing phoning home.
- **Two play modes.** Ranked (timed, scored, feeds streaks and awards) and Zen
  (untimed, unscored, no strike limit).
- **Two independent hard-mode toggles.** Turn off instant validation, and/or
  cap yourself at three mistakes. They stack.
- **A points system that rewards technique.** Points scale steeply with
  difficulty; wrong entries cost the most, and placements that were not yet
  logically deducible — lucky guesses — cost a little too.
- **Gamification.** Streaks with a forgiveness freeze, levels, achievements,
  and per-tier stats.
- **Built to be accessible.** Dynamic Type, VoiceOver labels on every cell,
  large touch targets, and a colorblind-safe board palette.

## Getting started

```bash
npm install
npx expo start
```

Press `i` for the iOS Simulator.

> **On a physical iPhone, Expo Go from the App Store will not work.** That build
> is pinned to SDK 54, so it cannot load this app. Use a development build
> (`eas build -p ios --profile development`) or `eas go`.

## Checks

All three must pass before every commit:

```bash
npx tsc --noEmit && npx eslint src --ext .ts,.tsx && npx jest
```

## Layout

| Path | What lives there |
| --- | --- |
| `src/game/` | The engine — pure TypeScript, no React, no Expo. Board, solver, technique ladder, grading, generation, scoring. |
| `src/data/` | SQLite persistence: games, stats, achievements, puzzle bank. |
| `src/state/` | App-wide contexts: game in play, progress, settings. |
| `src/screens/` | One folder per screen. |
| `src/navigation/` | Typed navigator and route params. |
| `src/theme/` | `useC()` color tokens. |
| `src/utils/` | Pure helpers that aren't engine logic. |

See [AGENTS.md](AGENTS.md) for conventions, the difficulty ladder, the scoring
model, and the branch/release workflow.
