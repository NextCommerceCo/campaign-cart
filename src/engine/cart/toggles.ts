import { mergeLines, publicToggle, toggleGroup } from './cart';
import type { Context } from '../engine';

export { toggleGroup };

export function createToggles(ctx: Context) {
  const inFlight = new Map<number, AbortController>();

  return {
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
      ctx.emit('selector.calculating', publicToggle(ctx.getState(), group, own));
      ctx.api
        .calculate({ lines, vouchers: cart.coupons, currency: campaign.currency }, { signal: controller.signal })
        .then((summary) => {
          const line = summary.lines.find((l) => l.package_id === packageId);
          if (inFlight.get(packageId) !== controller) return;
          ctx.update('toggles', { [packageId]: { key, quantity, line } });
          ctx.emit('selector.calculated', publicToggle(ctx.getState(), group, own));
        })
        .catch((err: unknown) => {
          if (inFlight.get(packageId) === controller) ctx.fail('selector.calculate', err);
        })
        .finally(() => {
          if (inFlight.get(packageId) === controller) inFlight.delete(packageId);
        });
    },
  };
}

export type ToggleActions = ReturnType<typeof createToggles>;
