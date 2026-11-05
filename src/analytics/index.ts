import type { Engine } from '../engine/engine';
import type { Line, SummaryLine } from '../engine/cart/types';
import type { AnalyticsName, AnalyticsTrace } from '../engine/events/analytics';
import type { EventMap, EventName } from '../engine/events/bus';
import type { ApiOrder, ApiOrderLine } from '../engine/types';
import { startLegacyDataLayer } from '../compat/analytics';
import { newId } from '../engine/id';
import { purchaseId, upsellId } from '../engine/order';
import { createLedger } from './state';
import { cartEcommerce, currency, ecommerce, orderItem, taxIncluded, valueOf } from './ecommerce';

export interface AnalyticsOptions {
  apiKey: string;
  version: string;
  nextCampaign: boolean;
  dataLayer?: boolean;
}

type Win = Window & {
  nextCampaign?: { config(o: { apiKey: string }): void; event(name: string, data: object): void };
};

const NEXT_CAMPAIGN_SCRIPT = 'https://campaigns.apps.29next.com/js/v1/campaign/';

export function startAnalytics(engine: Engine, options: AnalyticsOptions): void {
  const win = window as Win;
  const ledger = engine.attach(createLedger);
  const legacyExitIntent = startLegacyDataLayer(engine, {
    apiKey: options.apiKey,
    version: options.version,
    dataLayer: options.dataLayer,
  });

  const trace = (trigger: EventName, name: string, sent: boolean, reason: string, id?: string) => {
    const data: AnalyticsTrace = { trace: 'analytics', trigger, name, sent, reason, ...(id && { id }) };
    engine.log.debug(`analytics ${name} ${sent ? 'sent' : 'not sent'}: ${reason}`, data);
  };
  const skip = (trigger: EventName, name: AnalyticsName, reason: string) => trace(trigger, name, false, reason);

  const emit = (
    name: AnalyticsName,
    params: Record<string, unknown>,
    why: { trigger: EventName; reason: string; id?: string },
  ) => {
    const id = why.id ?? newId();
    const context = engine.eventContext();
    engine.events.emit('analytics', { name, id, time: new Date().toISOString(), params, context });
    trace(why.trigger, name, true, why.reason, id);
  };

  const names = (lines: Line[]) =>
    lines.map((l) => `${engine.getPackage(l.package_id)?.name ?? l.package_id} ×${l.quantity}`).join(', ');

  let ready = false;
  let priced: SummaryLine[] | undefined;
  const upsellPages = new Set<string>();
  const tier = () => engine.getState().cart.summary?.shipping_method?.name ?? 'Standard';

  const oncePerCheckout = (
    trigger: EventName,
    name: AnalyticsName,
    params: () => Record<string, unknown>,
    reason: string,
  ) => {
    const checkout = engine.checkout;
    if (!checkout || !engine.getState().checkout?.id) return skip(trigger, name, 'The checkout has not started');
    if (checkout.reported(name)) return skip(trigger, name, 'Already sent for this checkout');
    emit(name, params(), { trigger, reason });
    checkout.markReported(name);
  };

  const rawOrder = (refId: string): ApiOrder | undefined => {
    const order = engine.getState().order?.order;
    return order?.ref_id === refId ? order : undefined;
  };

  const onReady = () => {
    ready = true;
    const { page_location, page_referrer } = engine.eventContext();
    const page_title = document.title;
    emit(
      'page_view',
      { page_location, page_title, page_referrer },
      { trigger: 'sdk.ready', reason: 'Every page load' },
    );
    const ids = [
      ...new Set(
        [...document.querySelectorAll('[data-next-package-id]')].map((el) =>
          Number(el.getAttribute('data-next-package-id')),
        ),
      ),
    ];
    const viewed = ids.filter((id) => engine.getPackage(id)).map((id) => ({ package_id: id, quantity: 1 }));
    const packages = `${viewed.length} packages on the page`;
    if (viewed.length === 1) {
      emit('view_item', ecommerce(engine, viewed), { trigger: 'sdk.ready', reason: 'One package on the page' });
      skip('sdk.ready', 'view_item_list', 'Only one package on the page, so view_item instead');
    } else if (viewed.length > 1) {
      const { value: _, ...list } = ecommerce(engine, viewed);
      emit(
        'view_item_list',
        { ...list, item_list_id: 'product_list', item_list_name: 'Product List' },
        { trigger: 'sdk.ready', reason: packages },
      );
      skip('sdk.ready', 'view_item', `${packages}, so view_item_list instead`);
    } else {
      skip('sdk.ready', 'view_item', 'No package on the page');
      skip('sdk.ready', 'view_item_list', 'No package on the page');
    }
  };

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

  const onPaid = ({ ref_id }: EventMap['order.paid']) => {
    const order = engine.getState().order?.paidOrder;
    if (order?.ref_id !== ref_id) return skip('order.paid', 'purchase', 'The order is not in the state');
    if (ledger.has(`purchase:${purchaseId(order)}`))
      return skip('order.paid', 'purchase', 'Already sent for this order in this browser');
    sendPurchase(order, { trigger: 'order.paid', reason: 'Once per order, when it is paid' });
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

  const onLoaded = ({ ref_id }: EventMap['order.loaded']) => {
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
  };

  engine.on(
    '*',
    (e) => {
      if (e.name === 'sdk.ready') {
        onReady();
        if (!(e.data as EventMap['sdk.ready']).cart.lines.length) return reportCart([], 'sdk.ready');
        return priced && reportCart(priced, 'sdk.ready');
      }
      if (!ready) {
        if (e.name === 'cart.updated') priced = undefined;
        if (e.name === 'cart.calculated') priced = engine.getState().cart.summary?.lines;
        return;
      }
      legacyExitIntent(e);
      switch (e.name) {
        case 'cart.updated':
          return (e.data as EventMap['cart.updated']).lines.length ? undefined : reportCart([], 'cart.updated');
        case 'cart.calculated':
          reportCart(engine.getState().cart.summary?.lines ?? [], 'cart.calculated');
          return emit('update_cart', cartEcommerce(engine), {
            trigger: e.name,
            reason: 'After every price update',
          });
        case 'checkout.started':
          return oncePerCheckout(
            e.name,
            'begin_checkout',
            () => cartEcommerce(engine),
            'Once per checkout, when its form is ready',
          );
        case 'user.created': {
          const { currency, value } = cartEcommerce(engine);
          return emit(
            'generate_lead',
            { currency, value, lead_source: 'checkout' },
            { trigger: e.name, reason: 'Once, when the contact details saved an open cart' },
          );
        }
        case 'address.entered':
        case 'shipping.settled': {
          if (e.name === 'address.entered' && (e.data as EventMap['address.entered']).type !== 'shipping') return;
          const method = e.name === 'shipping.settled' ? (e.data as EventMap['shipping.settled']) : undefined;
          return oncePerCheckout(
            e.name,
            'add_shipping_info',
            () => ({
              ...cartEcommerce(engine),
              ...(method?.price !== undefined && { shipping: method.price }),
              shipping_tier: method?.name ?? tier(),
            }),
            'Once per checkout, when the shipping address is valid or a shipping method is picked',
          );
        }
        case 'checkout.submitted': {
          const { payment_method } = e.data as EventMap['checkout.submitted'];
          return oncePerCheckout(
            e.name,
            'add_payment_info',
            () => ({
              ...cartEcommerce(engine),
              payment_type: payment_method === 'card_token' ? 'Credit Card' : payment_method,
            }),
            'Once per checkout, when a submit passes its checks',
          );
        }
        case 'promotion.viewed':
        case 'promotion.clicked': {
          const { id, name, creative } = e.data as EventMap['promotion.viewed'];
          return emit(
            e.name === 'promotion.viewed' ? 'view_promotion' : 'select_promotion',
            { promotion_id: id, ...(name && { promotion_name: name }), creative_name: creative },
            {
              trigger: e.name,
              reason: `Every time a promotion is ${e.name === 'promotion.viewed' ? 'shown' : 'clicked'}`,
            },
          );
        }
        case 'order.loaded':
          return onLoaded(e.data as EventMap['order.loaded']);
        case 'order.paid':
          return onPaid(e.data as EventMap['order.paid']);
        case 'upsell.viewed': {
          const { ref_id, page } = e.data as EventMap['upsell.viewed'];
          if (upsellPages.has(page)) return skip(e.name, 'view_upsell', 'Already sent for this upsell page');
          upsellPages.add(page);
          return emit(
            'view_upsell',
            { order_id: ref_id, page_path: page, currency: currency(engine) },
            { trigger: e.name, reason: 'Once per upsell page, when an offer is shown' },
          );
        }
        case 'upsell.skipped': {
          const { ref_id, lines } = e.data as EventMap['upsell.skipped'];
          const package_id = lines[0]?.package_id;
          const name = package_id ? engine.getPackage(package_id)?.name : undefined;
          return emit(
            'skip_upsell',
            { order_id: ref_id, ...(package_id && { package_id }), ...(name && { package_name: name }) },
            { trigger: e.name, reason: 'Every time an upsell is skipped' },
          );
        }
      }
    },
    { replay: true },
  );
  if (engine.getState().checkout?.id && engine.checkout && !engine.checkout.reported('begin_checkout'))
    oncePerCheckout(
      'checkout.started',
      'begin_checkout',
      () => cartEcommerce(engine),
      'Not sent on the page that started this checkout',
    );

  if (options.nextCampaign && !document.querySelector(`script[src="${NEXT_CAMPAIGN_SCRIPT}"]`)) {
    const script = Object.assign(document.createElement('script'), { src: NEXT_CAMPAIGN_SCRIPT, async: true });
    script.onload = () => {
      win.nextCampaign?.config({ apiKey: options.apiKey });
      win.nextCampaign?.event('page_view', { title: document.title, url: location.href });
    };
    document.head.append(script);
  }
}
