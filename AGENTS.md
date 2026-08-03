# Expo HAS CHANGED

Read the exact versioned docs at https://docs.expo.dev/versions/v57.0.0/ before
writing any code. SDK 57 (React Native 0.86, React 19.2) — not 56, which is what
the sibling Praxtus repo pins.

# Project

A React Native (Expo SDK 57, TypeScript) Sudoku game for iOS. Everything runs
**on device**: puzzles are generated locally, progress/points/streaks/awards are
stored locally, and the app works with the radio off. There is no backend, no
account, and no login wall — the app opens straight into a playable board.

Machine identifiers, fixed now because they are expensive to change later:
bundle id + android package `com.siqbal.sudoku`, app.json `slug` `sudoku`, URL
`scheme` `sudoku`, npm package `sudoku`. The **display name is still open** —
pick it whenever, and change only `app.json`'s `name` and UI copy. That
separation is the lesson from Praxtus (shipped as `Praxtus`, still
`com.siqbal.titanhatch` internally because the bundle id is the App Store
Connect app identity — changing it makes a *new* app and abandons the
TestFlight build and tester history). Do not let a naming decision drag the
bundle id with it.

# Who it is for

The first and most important player is **the owner's mum**. That is not a
footnote — it settles arguments that would otherwise be taste:

- **Forgiving by default.** `instantValidation` on, `strikeLimit` off, hints
  available and unlimited. The hard modes exist and are one tap away, but the
  app never starts someone in them.
- **Accessibility is a requirement, not polish.** Dynamic Type is respected
  everywhere including the board; touch targets are ≥ 44pt; every cell and
  control has a VoiceOver label. A layout that breaks at large text sizes is a
  bug, not a nice-to-have.
- **Never punish with the gamification.** Streaks get a **freeze** (see
  **Modes**); losing three weeks of progress to one busy day is stressful, not
  motivating. Notifications are opt-in, once a day, and gently worded.
- **No monetization.** No ads, no IAP, no paywall, no analytics SDK, ever. This
  is a gift, not a product. Anything that would make sense "for retention" but
  feels manipulative to a family member does not ship.

**Local-only, not local-forever.** Nothing may assume single-device. Every
persisted record carries a stable `id` (uuid), `updatedAt`, and `deviceId`, and
all writes go through `src/data/` — never `AsyncStorage.setItem`/raw SQL from a
screen. When Game Center leaderboards or iCloud sync land later, that layer
grows a sync adapter; screens do not change. A record without `updatedAt` is a
bug, even though today nothing reads it.

# Structure

- `src/game/` — **the engine. Pure TypeScript, zero React, zero imports from
  anywhere else in `src/`.** This is the part with real algorithmic content and
  it must stay testable in isolation and runnable off the UI thread.
  - `board.ts` — grid representation, units (rows/cols/boxes), peer tables,
    candidate bitmasks. Cells are a flat `Uint8Array(81)`; candidates are a
    9-bit mask in a `Uint16Array(81)`. No arrays-of-arrays, no objects per cell
    — the technique solver runs on every move and allocation is the whole cost.
  - `solver.ts` — brute-force (DLX / bitmask backtracking) solver used for
    *validity* and *uniqueness* only. Never used to grade or to justify a move.
  - `techniques/` — one file per human technique, each exporting a pure
    `(board) => TechniqueResult | null`. Registered in order of cost in
    `techniques/registry.ts`. This directory serves two consumers: difficulty
    grading and the guess penalty (see **Scoring**). Adding a technique means
    adding its file, registering it with a cost, and adding fixtures.
  - `grading.ts` — runs the technique ladder to classify a solved-by-logic
    puzzle into a tier.
  - `generator.ts` — seeded puzzle generation (see **Generation**).
  - `types.ts` — `Difficulty`, `Cell`, `Move`, `TechniqueResult`, `PuzzleSeed`.
- `src/screens/<area>/<feature>/` — one folder per screen: `FeatureScreen.tsx`
  plus optional `components/`, `icons.tsx`, `styles.ts`, `constants.ts`.
  Screens never live loose next to feature folders. Per-feature icon files are
  deliberate (feature isolation beats DRY for icons).
- `src/navigation/` — `AppNavigator` (routes), `types.ts` (`RootStackParamList`,
  `useAppNavigation()`), `navigationRef`. **No `useNavigation<any>`** — use
  `useAppNavigation()` and type `useRoute` with
  `RouteProp<RootStackParamList, '...'>`. New screens: register the route AND
  add it to `RootStackParamList`.
- `src/state/` — app-wide contexts. `GameContext` (the board in play, moves,
  undo stack, timer), `ProgressContext` (points, streak, level, achievements),
  `SettingsContext` (the two difficulty toggles, theme, haptics, sound).
  On-device prefs use AsyncStorage keys named `sudoku.<thing>.v1`.
- `src/data/` — persistence. `db.ts` (expo-sqlite handle + migrations),
  one module per domain (`games.ts`, `stats.ts`, `achievements.ts`,
  `puzzleBank.ts`) exposing `rowToX`/`xToRow` mappers. Screens never see SQL.
- `src/utils/` — pure, unit-tested helpers that are *not* engine logic (date
  math for streaks, time formatting, number formatting). No barrel files;
  import modules directly.
- `src/theme/` — colors come from `useC()` tokens (`C.fg`, `C.acc`, `C.rule`,
  …); never hard-code palette colors in screens. The board is the one place
  with a lot of semantic color (given / entered / selected / peer-highlight /
  same-digit / conflict / hint) — those are `C.board.*` tokens, still from
  `useC()`, never literals. **Conflict state is never signalled by red-vs-green
  alone** — that pairing is the most common form of colorblindness and it is
  the one cue the game most needs a player to read. Use amber/blue hues, and
  always back color with a second channel (weight, underline, or an icon).

# The board is 81 cells and it will still drop frames

Two things in this app are expensive, and both have the same fix — keep them
off the interaction path:

1. **Generation.** Making a puzzle that is unique *and* graded at a requested
   tier costs many solver runs, and Master can take seconds. Never generate
   inside `onPress`.
2. **Move justification.** The guess penalty needs the technique ladder run
   against the pre-move board, on every placement.

Both are handled by deferral, not by optimism:

- A **puzzle bank** (`src/data/puzzleBank.ts`) keeps N pre-generated puzzles
  per tier in SQLite. "New game" pops one — instant, synchronous. A background
  top-up refills the bank after the game starts, throttled through
  `InteractionManager.runAfterInteractions`, never while the user is typing.
  Ship a seeded starter bank so a cold first launch is instant too.
- Justification is computed **after** the move renders and reconciled into the
  score, so input latency never depends on the solver. The move is recorded
  immediately with `justification: 'pending'`.

If a tier's bank is empty (fresh install, bank drained), show a generating
state — an honest spinner beats a frozen tap.

# Generation

Generate seeded and deterministically: `generate(seed, difficulty)` is a pure
function of its arguments. Use an explicit PRNG in `src/game/rng.ts` —
**never `Math.random()`** in the engine, or puzzles stop being reproducible and
the daily challenge breaks.

That determinism is what buys the **daily challenge with no server**: the seed
is derived from the UTC date (`seedFromDate(date)`), so every install produces
the identical puzzle for a given day without anything phoning home.

Invariants every generated puzzle must satisfy, asserted in tests:

- exactly one solution (uniqueness — verified by the brute-force solver
  counting to 2 and stopping),
- solvable by the technique ladder alone, with **no guessing**,
- graded tier equals the requested tier.

**Clue count is not difficulty.** A 26-given puzzle can be Easy and a 30-given
puzzle can be Extreme. Grade by the techniques the logical path *requires*,
never by how many cells are filled. This is the single most common way to get
sudoku difficulty wrong — do not add a clue-count heuristic "as a fast path".

# Difficulty

Six tiers, `Difficulty` in `src/game/types.ts`, in this order:

`easy` → `medium` → `hard` → `expert` → `extreme` → `master`

(The brief said "easy, medium, difficult, hard, extreme, master" — `difficult`
and `hard` are the same word, so the ladder uses `expert` for that rung.)

A puzzle's tier is the **highest-cost technique its logical path requires**,
tie-broken by how often the top techniques are needed. The ladder, defined once
in `techniques/registry.ts`:

| Tier | Unlocks |
| --- | --- |
| `easy` | full house, last digit, naked single, hidden single (box) |
| `medium` | hidden single (row/col), locked candidates (pointing + claiming), naked pair |
| `hard` | hidden pair, naked triple, hidden triple, naked/hidden quad |
| `expert` | X-Wing, simple colouring, XY-Wing |
| `extreme` | Swordfish, XYZ-Wing, W-Wing, Jellyfish, unique rectangle, finned/sashimi fish |
| `master` | AIC / forcing chains — must require at least one chain step |

Each tier is cumulative. `master` is defined by a *floor* as well as a ceiling:
a puzzle that never needs a chain is not Master no matter how long it takes.

# Modes and toggles

**Play mode** is per-game and chosen at start:

- `ranked` — timed, scored, feeds streak / level / leaderboards / achievements.
- `zen` — no timer, no strike limit, no points. Recorded in history and counts
  toward "puzzles solved" achievements; earns **no** points, does **not**
  advance the daily streak, and is excluded from best-time stats. Any new
  achievement must state which side of that line it sits on.

**Free play** is the entry point that generates any tier on demand, unlimited,
alongside the structured content (daily challenge + a progression ladder that
gates the higher tiers until earned). Both exist; free play is not gated.

**Two independent difficulty toggles** in `SettingsContext`, either usable
alone, both stacking:

- `instantValidation` (default on). Off = the app never tells you a cell is
  wrong; you find out on submit. This is the harder of the two.
- `strikeLimit` (default off). On = 3 wrong entries ends the run.

Both are per-game settings captured into the game record at start, because they
change the score multiplier — reading them from settings at *scoring* time
would let a player flip a toggle mid-game and rewrite their multiplier.

**Streak freeze.** A streak survives one missed day per earned freeze; freezes
accrue slowly (one per N consecutive days, capped) and spend automatically. The
streak calculation is therefore *not* "days since last gap" — it walks the play
history applying freezes, which is why it lives in a tested pure helper
(`src/utils/streak.ts`) and not inline in a screen.

**Input mode** (`inputMode`, default `cell-first`): `cell-first` selects a cell
then a digit; `digit-first` selects a digit then paints cells. Both ship —
players are genuinely split, and it is a small state-machine difference
contained entirely in the board component.

**Assists:** pencil marks (manual, plus an auto-candidate toggle), unlimited
undo, and hints that reveal the *next logically justified step* using the same
technique ladder as scoring — a hint explains the technique by name, so the app
teaches rather than just filling a cell.

# Scoring

All tunable numbers live as exported `SCREAMING_SNAKE` constants in
`src/game/scoring.ts`. No score arithmetic anywhere else.

`score = max(0, (BASE_POINTS[tier] - penalties) * multipliers)`

`BASE_POINTS` rises steeply with tier so difficulty is the dominant term — a
solved Master is worth many Easies, deliberately, so grinding Easy is never the
efficient path.

Penalties (flat, applied before multipliers):

- **wrong entry** — scaled off base; escalates on repeats in the same cell, so
  brute-forcing a cell 1–9 is strictly punished.
- **unjustified placement** — the "random guess" penalty, small but real.
- **hint used** — the largest single penalty.

**Detecting a guess.** After each *correct* placement, run the technique ladder
against the board **as it was before the move**, capped at the puzzle's own
tier. If the placed digit is in the set of deducible placements, the move is
`justified`; if not, the player got there by luck and it is `unjustified`.
Wrong entries are never routed through this check — they are already penalized
harder as wrong.

Two rules that keep this fair and fast:

- Justification is computed against the **true candidate set**, never the
  player's pencil marks. Marks are a UI affordance and are frequently wrong or
  stale; scoring off them would penalize sloppy note-keeping instead of
  guessing.
- Cap at the puzzle's tier. Running Master-tier chains to justify a move in an
  Easy puzzle is wasted work and would mark a legitimately-deduced move
  unjustified only because a cheaper technique found it first.

Multipliers stack: speed vs. the tier's par time, flawless (no wrong entries),
no hints, each hard-mode toggle, and current streak (capped). Auto-candidate
fill, if it ships, caps the achievable multiplier — it does most of the
thinking.

# Persistence

- **SQLite (`expo-sqlite`)** for anything with history or aggregation: game
  records, per-tier stats, achievement unlocks, the puzzle bank, the daily
  challenge log. Not AsyncStorage — streak and stats screens are queries, and
  rehydrating a JSON blob to compute a per-tier best time is how that gets slow.
- **AsyncStorage** only for small scalar prefs, keys `sudoku.<thing>.v1`.
- Schema source of truth: `src/data/migrations/*.ts`, ordered and applied on
  boot by `db.ts` via `user_version`. Migrations are append-only and never
  edited once committed — a released build has already run them.
- An **in-progress game survives a cold kill**: the current board, move stack,
  elapsed time, and toggles are checkpointed on every move and on
  `AppState` background. Losing a 40-minute Master board to a crash is the
  worst bug this app can have.

# Code style

- **Naming:** every identifier describes what it holds — no single-letter
  variables, parameters, or callback args (enforced by the `id-length` lint
  rule). Allowed exceptions: `i`/`j` as for-loop counters initialized in the
  loop header (nested loops only for the inner one), and `_` for intentionally
  unused values. Note this bites hardest in the engine, where `r`/`c`/`b` are
  the tempting names — write `rowIndex`, `columnIndex`, `boxIndex`. House
  names: `colors = useC()` for theme tokens, `styles = StyleSheet.create(...)`,
  `prev` for setState updaters, `event` / `error` for handlers, singular-of-
  collection for array callbacks (`cells.map((cell) => …)`).
- **Constants:** reusable values live as exported `SCREAMING_SNAKE` constants
  in the module that owns the domain (`BASE_POINTS`/`PENALTIES`/`PAR_TIMES` in
  `game/scoring.ts`, `TECHNIQUE_COSTS` in `game/techniques/registry.ts`,
  `DIFFICULTY_LABELS` in a feature `constants.ts`) — never inlined twice.
  Export them so they're findable and tunable in one place.
- **The engine imports nothing.** No React, no Expo, no `src/state`, no
  `src/data`. If a technique needs a setting, it takes a parameter. This is
  what lets the engine be fuzzed in plain node and later moved to a worklet.

# Tests

`src/__tests__/`, jest. New logic gets tests; when deleting code, delete its
tests. The engine is where tests actually earn their keep:

- **Fixtures over hand-written boards.** Golden puzzles per tier live in
  `src/__tests__/fixtures/`, each with its expected grade and the technique
  sequence its path requires. A technique change that re-grades a fixture
  should fail loudly — that is the point.
- **Property tests on the generator.** For a run of seeds per tier: exactly one
  solution, no guessing required, graded tier matches requested.
- **Each technique gets a positive and a negative fixture** — a board where it
  fires with a known elimination, and a near-miss board where it must not.
  Techniques that over-fire produce unsolvable puzzles and are miserable to
  debug from the UI.
- **Seeded determinism:** `generate(seed, tier)` twice returns identical
  output. A `Math.random()` that sneaks into the engine fails here.

# Running it

- Simulator: `npx expo start` and press `i`. Expo Go for the simulator can be
  downloaded for any SDK via Expo CLI, so this path works on SDK 57.
- **Physical iPhone: Expo Go from the App Store will not work.** The App Store
  build is pinned to SDK 54 (Apple approval delays since May 2026), so it
  cannot load an SDK 57 app. Use a development build (`eas build -p ios
  --profile development`) or `eas go`. Expect this to be the first confusing
  failure a new agent hits.
- A dev build is needed anyway the moment Game Center, iCloud, or IAP land.

# Parallel agents (git worktrees)

Several agents can build different features simultaneously, each in its own
git worktree — a separate working directory sharing one `.git`. One agent per
worktree, one feature per branch.

## Creating one

Use `scripts/worktree.sh`, not plain `git worktree add`:

    scripts/worktree.sh new <name>            # worktree + branch feat/<name>
    scripts/worktree.sh new <name> --install  # isolated node_modules
    scripts/worktree.sh list
    scripts/worktree.sh rm <name>

`new` creates `../sudoku-worktrees/<name>` on `feat/<name>` off freshly fetched
`origin/main`, then **symlinks `node_modules`** (sharing is fine for the
tsc/eslint/jest loop; pass `--install` when the branch changes dependencies,
otherwise an `npm install` in one tree mutates every other tree) and **assigns
a distinct `RCT_METRO_PORT`** so two dev servers can run at once. Unlike
Praxtus there are no gitignored env files to copy — this app has no secrets and
no backend, which is one of the nicer consequences of staying on-device.

Worktrees are **siblings** of the repo, never nested inside it: nested,
Metro/watchman scan them and hit duplicate-module (haste) collisions.

## Splitting the work — the part that actually matters

Parallel agents fail by editing the same file on different branches, not by
anything git does. Split by **feature area with disjoint file ownership**, and
name the owned paths in each agent's brief.

Clean seams (safe to parallelize): different `src/screens/<area>/<feature>/`
folders, different `src/game/techniques/*.ts` files, different `src/data/`
domains, different `src/utils/` modules.

Collision hotspots (assume conflict — give ONE agent the edit, or serialize):

- `src/navigation/types.ts` + `src/navigation/AppNavigator.tsx` — **every new
  screen touches both**, so any two agents adding screens will collide.
- `src/game/techniques/registry.ts` — every new technique registers here, and
  the order *is* the difficulty ladder. Two agents adding techniques conflict
  both textually and semantically.
- `src/game/types.ts` and `src/game/scoring.ts` — engine-wide vocabulary and
  every tunable number.
- `src/state/*Context.tsx` — two features adding fields to the same context
  conflict.
- `src/data/migrations/` — parallel agents must use **distinct numbered
  filenames**, and migrations still apply in order.
- `app.json`, `package.json`, `AGENTS.md`.

## Lifecycle

Each worktree is a normal checkout: work → `npx tsc --noEmit && npx eslint src
--ext .ts,.tsx && npx jest` → commit → PR → merge, exactly as in Workflow
below. Then `scripts/worktree.sh rm <name>`.

Integrate **one PR at a time**. After each merge, every other in-flight
worktree should `git fetch origin && git rebase origin/main` and re-run the
three checks — a branch that was green against the old `main` is not
necessarily green against the new one. This matters more here than in a CRUD
app: a merged technique change can re-grade puzzles under another branch's
feet, and that shows up as a *test* failure, not a merge conflict.

# Workflow

- Branch off `main` per change: `feat/…`, `fix/…`, `chore/…`, `refactor/…`.
  Never commit directly to `main`.
- **Environment branches** (one-way flow `main → dev → stage → prod`, all
  fast-forward only — never commit to them directly):
  - `main` — the trunk; every PR lands here first.
  - `sandbox` — scratch space for experiments; may be force-reset to `main`.
  - `dev` — the owner's own development build; fast-forward from `main` freely.
  - `stage` — the **beta channel**: what friend-testers run (TestFlight).
    Fast-forward from `dev` when a beta is cut; every beta gets a
    `vX.Y.Z-beta.N` tag + a GitHub **Pre-release** targeting `stage`. Only
    beta-blocking fixes land here (then flow back to `main`).
  - `prod` — the **public release**: App Store code only. Fast-forward from
    `stage` at launch/update time; plain `vX.Y.Z` tags + full Releases target
    `prod`. Empty of releases until launch.
- **Cutting a beta (stage):** bump `version` on `main` (PR) if needed, then
  `git push origin main:dev main:stage`,
  `git tag -a vX.Y.Z-beta.N stage && git push origin vX.Y.Z-beta.N`,
  `gh release create vX.Y.Z-beta.N --target stage --prerelease --generate-notes`,
  and ship it: `git checkout stage && eas build -p ios --profile beta` then
  `eas submit -p ios --latest` (TestFlight).
- **Launching / releasing (prod):** `git push origin stage:prod`, then
  `git tag -a vX.Y.Z prod && git push origin vX.Y.Z` and
  `gh release create vX.Y.Z --target prod --generate-notes`; build with
  `eas build -p ios --profile production` from `prod`. The plain `v1.0.0` tag
  is reserved for the actual launch.
- **Branch-ref gotcha (has bitten us on Praxtus):** `git push origin main:stage`
  fast-forwards the **remote** `stage` but leaves the **local** `stage` ref
  behind. A later `git checkout stage` then lands on stale code — and anything
  built or tagged from it ships the wrong commit. After pushing to another
  branch's remote ref, resync the local one:

      git branch -f stage origin/stage      # or: git merge --ff-only origin/stage

  Same applies to `dev`/`sandbox`. Verify with `git rev-parse --short stage
  origin/stage` before building or tagging.
- Before every commit: `npx tsc --noEmit && npx eslint src --ext .ts,.tsx && npx jest`
  — all three must pass.
- Commits: conventional prefix (`feat(scope): …`), imperative subject, body
  explains the why.
- Ship via PR (`gh pr create`), merge with `gh pr merge --merge --delete-branch`.
