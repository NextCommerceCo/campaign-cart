import type { Line, SummaryLine } from '../engine/cart/types';
import type { EventName } from '../engine/events/bus';
import { catalogItem, reportedItem } from './items';
import type { Handlers, Report } from './report';

export function cartReports({ engine, emit, skip }: Report) {
  const label = (l: Line) => `${engine.getPackage(l.package_id)?.name ?? l.package_id} ×${l.quantity}`;

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
      skip(trigger, 'product_added_to_cart', nothingAdded);
      skip(trigger, 'product_removed_from_cart', nothingRemoved);
      return;
    }
    engine.cart.markReported(
      [...after].map(([package_id, { quantity, line }]) => ({ package_id, quantity, price: Number(line.unit_price) })),
      added.length > 0,
    );
    if (!removed.length) skip(trigger, 'product_removed_from_cart', nothingRemoved);
    for (const line of removed)
      emit('product_removed_from_cart', reportedItem(engine, line, before.get(line.package_id)!.price), {
        trigger,
        reason: `Removed since the last report: ${label(line)}`,
      });
    if (!added.length) skip(trigger, 'product_added_to_cart', nothingAdded);
    const first_in_session = !addedBefore;
    for (const line of added)
      emit(
        'product_added_to_cart',
        { ...catalogItem(engine, line, after.get(line.package_id)!.line), first_in_session },
        {
          trigger,
          reason:
            trigger === 'sdk.ready'
              ? `The cart was filled before this page: ${label(line)}`
              : `Added since the last report: ${label(line)}`,
        },
      );
  };

  const handlers: Handlers = {
    'cart.updated': (cart) => (cart.lines.length ? undefined : reportCart([], 'cart.updated')),
    'cart.calculated': (cart, name) => {
      reportCart(engine.getState().cart.summary?.lines ?? [], name);
      emit('cart_updated', cart, { trigger: name, reason: 'After every price update' });
    },
  };

  return { reportCart, handlers };
}
