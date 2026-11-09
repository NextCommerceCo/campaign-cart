import type { Logger } from '../engine/runtime/log';

/** A page's callback in `window.nextReady`, pushed before or after the SDK loaded. */
export type ReadyCallback<Next> = (next: Next) => void;

/**
 * Runs the callbacks the page queued in `window.nextReady` with `window.next`, then makes a
 * later push run at once.
 */
export function runReadyQueue<Next>(next: Next, log: Logger): void {
  const win = window as unknown as { nextReady?: ReadyCallback<Next>[] | { push(fn: ReadyCallback<Next>): void } };
  const run = (fn: ReadyCallback<Next>) => {
    try {
      fn(next);
    } catch (err) {
      log.error('nextReady callback failed', err);
    }
  };
  if (Array.isArray(win.nextReady)) win.nextReady.forEach(run);
  win.nextReady = { push: run };
}
