/** Runs where each `start()` supersedes the one before: its `stale()` turns true and its signal aborts. */
export function latestWins() {
  let seq = 0;
  let abort: AbortController | undefined;
  return {
    start() {
      const run = ++seq;
      abort?.abort();
      const controller = (abort = new AbortController());
      return { run, signal: controller.signal, stale: () => run !== seq };
    },
    cancel(): void {
      seq++;
      abort?.abort();
    },
    current: () => seq,
  };
}

/**
 * `latestWins` per key: a run supersedes the one before it with the same key. `dropPrevious()` aborts that
 * one; call it after this run's requests started, so a request both share is not cancelled.
 */
export function keyedLatestWins<K>() {
  const runs = new Map<K, AbortController>();
  return {
    start(key: K) {
      const previous = runs.get(key);
      const controller = new AbortController();
      runs.set(key, controller);
      return {
        signal: controller.signal,
        stale: () => runs.get(key) !== controller,
        dropPrevious: () => previous?.abort(),
        finish: () => void (runs.get(key) === controller && runs.delete(key)),
      };
    },
    /** Aborts and forgets the key's run; returns nothing to wait for. */
    cancel(key: K): void {
      runs.get(key)?.abort();
      runs.delete(key);
    },
    running: (key: K) => runs.has(key),
  };
}

/** Runs tasks one after another, each after the last settled, whether it resolved or rejected. */
export function serialize() {
  let tail: Promise<unknown> = Promise.resolve();
  return <T>(task: () => Promise<T>): Promise<T> => {
    const next = tail.then(task, task);
    tail = next;
    return next;
  };
}
