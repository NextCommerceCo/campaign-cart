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

/** Runs tasks one after another, each after the last settled, whether it resolved or rejected. */
export function serialize() {
  let tail: Promise<unknown> = Promise.resolve();
  return <T>(task: () => Promise<T>): Promise<T> => {
    const next = tail.then(task, task);
    tail = next;
    return next;
  };
}
