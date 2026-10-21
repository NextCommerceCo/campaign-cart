import { mergeLines } from './cart';
import type { Context } from './engine';
import { toggleGroup } from './values';

export function createToggles(ctx: Context) {
  const inFlight = new Map<number, AbortController>();

  return {
    price(packageId: number, quantity: number): void {
      const { campaign, cart, toggles } = ctx.getState();
      const group = toggleGroup(packageId);
      if (!campaign || !ctx.getPackage(packageId) || cart.groups[group]) return;
      const key = `${quantity}|${campaign.currency}|${[...cart.coupons].sort().join()}`;
      if (toggles[packageId]?.key === key) return;
      inFlight.get(packageId)?.abort();
      const controller = new AbortController();
      inFlight.set(packageId, controller);
      ctx.update('toggles', { [packageId]: { ...toggles[packageId], key, quantity } });
      const others = Object.fromEntries(Object.entries(cart.groups).filter(([id]) => id !== group));
      const lines = mergeLines({ ...others, [group]: { lines: [{ packageId, quantity }], vouchers: [] } });
      ctx.api
        .calculate({ lines, vouchers: cart.coupons, currency: campaign.currency }, { signal: controller.signal })
        .then((summary) => {
          const line = summary.lines.find((l) => l.package_id === packageId);
          if (inFlight.get(packageId) === controller) ctx.update('toggles', { [packageId]: { key, quantity, line } });
        })
        .catch((err: unknown) => {
          if (inFlight.get(packageId) === controller) ctx.fail('quote', err);
        })
        .finally(() => {
          if (inFlight.get(packageId) === controller) inFlight.delete(packageId);
        });
    },
  };
}

export type ToggleActions = ReturnType<typeof createToggles>;
