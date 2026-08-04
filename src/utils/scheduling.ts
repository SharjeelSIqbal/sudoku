/**
 * Deferring expensive work off the interaction path.
 *
 * Two things in this app are too slow to run on a tap — generating a puzzle,
 * and judging whether a placement was a guess — so both are scheduled through
 * here instead.
 *
 * This wraps `requestIdleCallback` rather than `InteractionManager`, which
 * React Native 0.86 deprecates and warns about at runtime. The `timeout`
 * matters: without it an idle callback can be starved indefinitely on a busy
 * screen, and a puzzle bank that never refills is worse than one that refills
 * during a slightly busy frame.
 */

/** A scheduled callback that has not necessarily run yet. */
export interface ScheduledTask {
  cancel: () => void;
}

declare const requestIdleCallback:
  | ((callback: () => void, options?: { timeout: number }) => number)
  | undefined;
declare const cancelIdleCallback: ((handle: number) => void) | undefined;

/** How long an idle callback may be starved before it is run anyway. */
const DEFAULT_IDLE_TIMEOUT_MS = 500;

export function runWhenIdle(
  callback: () => void,
  timeoutMs: number = DEFAULT_IDLE_TIMEOUT_MS,
): ScheduledTask {
  if (typeof requestIdleCallback === 'function') {
    const handle = requestIdleCallback(callback, { timeout: timeoutMs });
    return {
      cancel: () => {
        if (typeof cancelIdleCallback === 'function') {
          cancelIdleCallback(handle);
        }
      },
    };
  }

  // Jest and any runtime without the idle API fall back to the next tick,
  // which preserves the "not during this call" contract even if not the
  // "when the device is free" one.
  const timeoutHandle = setTimeout(callback, 0);
  return { cancel: () => clearTimeout(timeoutHandle) };
}
