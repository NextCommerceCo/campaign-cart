import type { Context } from '../engine';

export function createVisit(ctx: Context, now: () => number) {
  const visit = () => ctx.getState().visit;
  return {
    setMetadata(metadata: Record<string, string | number>): void {
      ctx.update('visit', { metadata });
    },
    noteExitIntentShown(): void {
      ctx.update('visit', { exitIntentShown: visit().exitIntentShown + 1 });
    },
    timerStart(id: string, durationMs: number): number {
      const at = now();
      const { [id]: start, ...others } = visit().timers;
      if (start === undefined) ctx.update('visit', { timers: { ...others, [id]: at } });
      else if (start + durationMs <= at) ctx.update('visit', { timers: others });
      return start ?? at;
    },
  };
}

export type VisitActions = ReturnType<typeof createVisit>;
