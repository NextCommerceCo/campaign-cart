import { mergeLines, toggleGroup } from './lines';
import { publicToggle } from './public';
import type { Context } from '../engine';
import { keyedLatestWins } from '../flow';
import type { Quotes } from './quotes';
import type { CartSummary } from './types';
import type { Selector } from '../events/selectors';

export { toggleGroup };

export function createToggles(ctx: Context, quotes: Quotes) {
  const runs = keyedLatestWins<number>();
  const viewed = new Set<number>();

  const selectorOf = (packageId: number, quantity: number): Selector => {
    const state = ctx.getState();
    const id = toggleGroup(packageId);
    return publicToggle(state, id, state.cart.groups[id] ?? { lines: [{ packageId, quantity }], vouchers: [] });
  };

  return {
    view(packageId: number, quantity: number): void {
      if (viewed.has(packageId)) return;
      viewed.add(packageId);
      ctx.emit('selector.viewed', selectorOf(packageId, quantity));
    },
    price(packageId: number, quantity: number): void {
      const { campaign, cart, toggles } = ctx.getState();
      const group = toggleGroup(packageId);
      if (!campaign || !ctx.getPackage(packageId) || cart.groups[group]) return;
      const others = Object.fromEntries(Object.entries(cart.groups).filter(([id]) => id !== group));
      const own = { lines: [{ packageId, quantity }], vouchers: [] };
      const body = {
        lines: mergeLines({ ...others, [group]: own }),
        vouchers: cart.coupons,
        currency: campaign.currency,
      };
      const key = quotes.key(body);
      if (toggles[packageId]?.key === key) return;
      const run = runs.start(packageId);
      run.dropPrevious();
      const settle = (summary: CartSummary) => {
        ctx.update('toggles', {
          [packageId]: { key, quantity, line: summary.lines.find((l) => l.package_id === packageId) },
        });
        ctx.emit('selector.priced', selectorOf(packageId, quantity));
      };
      const stored = quotes.stored(body);
      if (stored) settle(stored);
      if (quotes.fresh(body)) return run.finish();
      if (!stored) {
        ctx.update('toggles', { [packageId]: { ...toggles[packageId], key, quantity } });
        ctx.emit('selector.pricing', selectorOf(packageId, quantity));
      }
      quotes
        .calculate(body, { signal: run.signal })
        .then((summary) => {
          if (!run.stale()) settle(summary);
        })
        .catch((err: unknown) => {
          if (!run.stale()) ctx.fail('selector.price', err);
        })
        .finally(run.finish);
    },
  };
}

export type ToggleActions = ReturnType<typeof createToggles>;
