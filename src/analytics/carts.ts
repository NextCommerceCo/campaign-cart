import type { Line, SummaryLine } from '../engine/cart/types';
import type { EventName } from '../engine/events/bus';
import { cartEcommerce, ecommerce } from './ecommerce';
import type { Handlers, Report } from './report';

export function cartReports({ engine, emit, skip }: Report) {
  const names = (lines: Line[]) =>
    lines.map((l) => `${engine.getPackage(l.package_id)?.name ?? l.package_id} ×${l.quantity}`).join(', ');

  const reportCart = (lines: SummaryLine[], trigger: EventName) => {
    const { reported = [], added: addedBefore } = engine.getState().cart;
    const before = new Map(reported.map((l) => [l.package_id, l]));
    const after = new Map<number, { quantity: number; line: SummaryLine }>();
    for (const line of lines) {
      const seen = after.get(line.package_id);
      after.set(line.package_id, { quantity: (seen?.quantity ?? 0) + line.quantity, line: seen?.line ?? line });
    }
    const added: Line[] = [];
    const removed: Line[] = [];
    for (const id of new Set([...before.keys(), ...after.keys()])) {
      const diff = (after.get(id)?.quantity ?? 0) - (before.get(id)?.quantity ?? 0);
      if (diff > 0) added.push({ package_id: id, quantity: diff });
      if (diff < 0) removed.push({ package_id: id, quantity: -diff });
    }
    const nothingAdded = 'Nothing was added since the last report';
    const nothingRemoved = 'Nothing was removed since the last report';
    if (!added.length && !removed.length) {
      skip(trigger, 'add_to_cart', nothingAdded);
      skip(trigger, 'remove_from_cart', nothingRemoved);
      return;
    }
    engine.cart.markReported(
      [...after].map(([package_id, { quantity, line }]) => ({ package_id, quantity, price: Number(line.unit_price) })),
      added.length > 0,
    );
    if (removed.length)
      emit(
        'remove_from_cart',
        ecommerce(engine, removed, (id) => ({ unit_price: String(before.get(id)!.price) })),
        { trigger, reason: `Removed since the last report: ${names(removed)}` },
      );
    else skip(trigger, 'remove_from_cart', nothingRemoved);
    if (added.length)
      emit(
        'add_to_cart',
        { ...ecommerce(engine, added, (id) => after.get(id)!.line), first_in_session: !addedBefore },
        {
          trigger,
          reason:
            trigger === 'sdk.ready'
              ? `The cart was filled before this page: ${names(added)}`
              : `Added since the last report: ${names(added)}`,
        },
      );
    else skip(trigger, 'add_to_cart', nothingAdded);
  };

  const handlers: Handlers = {
    'cart.updated': (cart) => (cart.lines.length ? undefined : reportCart([], 'cart.updated')),
    'cart.calculated': (_, name) => {
      reportCart(engine.getState().cart.summary?.lines ?? [], name);
      emit('update_cart', cartEcommerce(engine), { trigger: name, reason: 'After every price update' });
    },
  };

  return { reportCart, handlers };
}
