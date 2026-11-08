import type { EventName } from '../engine/events/bus';
import type { Order } from '../engine/events/orders';
import { appliedCodes, publicOrder, purchaseId, upsellId } from '../engine/order';
import type { ApiOrder } from '../engine/types';
import type { Handlers, Report } from './report';
import type { Ledger } from '../engine/order';

export function orderReports({ engine, emit, skip }: Report, ledger: Ledger): Handlers {
  const upsellPages = new Set<string>();

  const rawOrder = (refId: string): ApiOrder | undefined => {
    const order = engine.getState().order?.order;
    return order?.ref_id === refId ? order : undefined;
  };

  const orderOf = (raw: ApiOrder): Order => publicOrder(raw, appliedCodes(raw, engine.getState().order?.coupon));

  const sendPurchase = (raw: ApiOrder, why: { trigger: EventName; reason: string }) => {
    const transaction = purchaseId(raw);
    emit('checkout_completed', orderOf(raw), { ...why, id: transaction });
    ledger.mark([`purchase:${transaction}`]);
  };

  /** order.paid came on an earlier page, such as the checkout, that was left before checkout_completed was sent. */
  const purchaseOwed = (raw: ApiOrder) => {
    const id = purchaseId(raw);
    const onThisPage = !ledger.has(id) || engine.getState().order?.paidOrder?.ref_id === raw.ref_id;
    if (raw.payment_complete_url || onThisPage || ledger.has(`purchase:${id}`)) return;
    sendPurchase(raw, {
      trigger: 'order.loaded',
      reason: 'order.paid came on an earlier page that was left before checkout_completed was sent',
    });
  };

  return {
    'order.paid': ({ ref_id }) => {
      const raw = engine.getState().order?.paidOrder;
      if (raw?.ref_id !== ref_id) return skip('order.paid', 'checkout_completed', 'The order is not in the state');
      if (ledger.has(`purchase:${purchaseId(raw)}`))
        return skip('order.paid', 'checkout_completed', 'Already sent for this order in this browser');
      sendPurchase(raw, { trigger: 'order.paid', reason: 'Once per order, when it is paid' });
    },
    'order.loaded': ({ ref_id }) => {
      const raw = rawOrder(ref_id);
      if (!raw) return skip('order.loaded', 'upsell_completed', 'The order is not in the state');
      purchaseOwed(raw);
      const order = orderOf(raw);
      const upsells = (raw.lines ?? [])
        .map((line, i) => ({ id: upsellId(raw, line), line: order.lines[i]! }))
        .filter((u) => u.line.upsell)
        .map((u, i) => ({ ...u, number: i + 1 }))
        .filter((u) => !ledger.has(u.id));
      if (!upsells.length) return skip('order.loaded', 'upsell_completed', 'No new accepted upsell');
      for (const { number, line } of upsells)
        emit(
          'upsell_completed',
          { ...order, upsell: { number, line } },
          { trigger: 'order.loaded', reason: `Accepted upsell ${number}`, id: `${raw.ref_id}-US${number}` },
        );
      ledger.mark(upsells.map((u) => u.id));
    },
    'upsell.viewed': (upsell, name) => {
      if (upsellPages.has(upsell.page)) return skip(name, 'upsell_viewed', 'Already sent for this upsell page');
      upsellPages.add(upsell.page);
      emit('upsell_viewed', upsell, { trigger: name, reason: 'Once per upsell page, when an offer is shown' });
    },
    'upsell.skipped': (upsell, name) =>
      emit('upsell_skipped', upsell, { trigger: name, reason: 'Every time an upsell is skipped' }),
  };
}
