import { mergeLines, toggleGroup } from './lines';
import { publicToggle } from './public';
import type { Context } from '../engine';
import type { Selector } from '../events/selectors';

export { toggleGroup };

export function createToggles(ctx: Context) {
  const inFlight = new Map<number, AbortController>();
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
      const lines = mergeLines({ ...others, [group]: own });
      const key = `${JSON.stringify(lines)}|${campaign.currency}|${[...cart.coupons].sort().join()}`;
      if (toggles[packageId]?.key === key) return;
      inFlight.get(packageId)?.abort();
      const controller = new AbortController();
      inFlight.set(packageId, controller);
      ctx.update('toggles', { [packageId]: { ...toggles[packageId], key, quantity } });
      ctx.emit('selector.pricing', selectorOf(packageId, quantity));
      ctx.api
        .calculate({ lines, vouchers: cart.coupons, currency: campaign.currency }, { signal: controller.signal })
        .then((summary) => {
          const line = summary.lines.find((l) => l.package_id === packageId);
          if (inFlight.get(packageId) !== controller) return;
          ctx.update('toggles', { [packageId]: { key, quantity, line } });
          ctx.emit('selector.priced', selectorOf(packageId, quantity));
        })
        .catch((err: unknown) => {
          if (inFlight.get(packageId) === controller) ctx.fail('selector.price', err);
        })
        .finally(() => {
          if (inFlight.get(packageId) === controller) inFlight.delete(packageId);
        });
    },
  };
}

export type ToggleActions = ReturnType<typeof createToggles>;
