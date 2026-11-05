import type { Context } from '../engine/engine';
import { REPORTED, REPORTED_KEEP } from '../engine/order';

/** The browser's REPORTED ledger, shared with the order state and the checkout. */
export function createLedger(ctx: Context) {
  const reported = () => ctx.local.get<string[]>(REPORTED) ?? [];
  return {
    has: (id: string) => reported().includes(id),
    mark(ids: string[]): void {
      ctx.local.set(REPORTED, [...new Set([...reported(), ...ids])].slice(-REPORTED_KEEP));
    },
  };
}

export type Ledger = ReturnType<typeof createLedger>;
