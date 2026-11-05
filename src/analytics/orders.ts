import type { EventName } from '../engine/events/bus';
import { purchaseId, upsellId } from '../engine/order';
import type { ApiOrder } from '../engine/types';
import { currency, orderItem, taxIncluded, valueOf } from './ecommerce';
import type { Handlers, Report } from './report';
import type { Ledger } from './state';

export function orderReports({ engine, emit, skip }: Report, ledger: Ledger): Handlers {
  const upsellPages = new Set<string>();

  const rawOrder = (refId: string): ApiOrder | undefined => {
    const order = engine.getState().order?.order;
    return order?.ref_id === refId ? order : undefined;
  };

  const sendPurchase = (order: ApiOrder, why: { trigger: EventName; reason: string }) => {
    const coupon = engine.getState().order?.coupon;
    const code = coupon?.refId === order.ref_id ? coupon.code : undefined;
    const transaction = purchaseId(order);
    const lines = (order.lines ?? []).filter((l) => !l.is_upsell);
    const incl = taxIncluded(engine, order);
    const items = lines.map((l, i) => orderItem(engine, order, l, i, incl));
    const discount = Number(order.total_discounts ?? 0);
    emit(
      'purchase',
      {
        currency: order.currency ?? currency(engine),
        transaction_id: transaction,
        value: valueOf(items),
        tax: Number(order.total_tax ?? 0),
        shipping: Number((incl ? order.shipping_incl_tax : order.shipping_excl_tax) ?? 0),
        affiliation: 'Online Store',
        items,
        ...(code && { coupon: code }),
        ...(discount > 0 && { discount }),
      },
      { ...why, id: transaction },
    );
    ledger.mark([`purchase:${transaction}`]);
  };

  /** order.paid came on an earlier page, such as the checkout, that was left before purchase was sent. */
  const purchaseOwed = (order: ApiOrder) => {
    const id = purchaseId(order);
    const onThisPage = !ledger.has(id) || engine.getState().order?.paidOrder?.ref_id === order.ref_id;
    if (order.payment_complete_url || onThisPage || ledger.has(`purchase:${id}`)) return;
    sendPurchase(order, {
      trigger: 'order.loaded',
      reason: 'order.paid came on an earlier page that was left before purchase was sent',
    });
  };

  return {
    'order.paid': ({ ref_id }) => {
      const order = engine.getState().order?.paidOrder;
      if (order?.ref_id !== ref_id) return skip('order.paid', 'purchase', 'The order is not in the state');
      if (ledger.has(`purchase:${purchaseId(order)}`))
        return skip('order.paid', 'purchase', 'Already sent for this order in this browser');
      sendPurchase(order, { trigger: 'order.paid', reason: 'Once per order, when it is paid' });
    },
    'order.loaded': ({ ref_id }) => {
      const order = rawOrder(ref_id);
      if (!order) return skip('order.loaded', 'upsell_purchase', 'The order is not in the state');
      purchaseOwed(order);
      const upsells = (order.lines ?? [])
        .filter((l) => l.is_upsell)
        .map((line, i) => ({ id: upsellId(order, line), number: i + 1, line }))
        .filter((u) => !ledger.has(u.id));
      if (!upsells.length) return skip('order.loaded', 'upsell_purchase', 'No new accepted upsell');
      const incl = taxIncluded(engine, order);
      for (const { number, line } of upsells) {
        const item = orderItem(engine, order, line, 0, incl);
        const transaction = `${order.ref_id}-US${number}`;
        emit(
          'upsell_purchase',
          {
            currency: item.currency,
            transaction_id: transaction,
            value: valueOf([item]),
            tax: 0,
            shipping: 0,
            affiliation: 'Upsell',
            items: [item],
            upsell: {
              original_order_id: order.ref_id,
              upsell_number: number,
              package_id: String(line.package ?? line.product_id ?? line.id),
              package_name: line.product_title,
            },
          },
          { trigger: 'order.loaded', reason: `Accepted upsell ${number}`, id: transaction },
        );
      }
      ledger.mark(upsells.map((u) => u.id));
    },
    'upsell.viewed': ({ ref_id, page }, name) => {
      if (upsellPages.has(page)) return skip(name, 'view_upsell', 'Already sent for this upsell page');
      upsellPages.add(page);
      emit(
        'view_upsell',
        { order_id: ref_id, page_path: page, currency: currency(engine) },
        { trigger: name, reason: 'Once per upsell page, when an offer is shown' },
      );
    },
    'upsell.skipped': ({ ref_id, lines }, name) => {
      const package_id = lines[0]?.package_id;
      const packageName = package_id ? engine.getPackage(package_id)?.name : undefined;
      emit(
        'skip_upsell',
        { order_id: ref_id, ...(package_id && { package_id }), ...(packageName && { package_name: packageName }) },
        { trigger: name, reason: 'Every time an upsell is skipped' },
      );
    },
  };
}
