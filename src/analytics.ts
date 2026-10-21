import { mergeLines } from './engine/cart';
import type { Engine } from './engine/engine';
import type { CartState, EventMap, ExitIntentDetail, Order, OrderLine, SummaryLine } from './engine/types';

export interface AnalyticsOptions {
  apiKey: string;
  version: string;
  nextCampaign: boolean;
}

type Line = { package_id: number; quantity: number };

const withoutQuery = (url: string) => {
  try {
    const u = new URL(url);
    return u.origin + u.pathname;
  } catch {
    return '';
  }
};
type DataLayerEvent = { event: string; event_id: string; [key: string]: unknown };
type Win = Window & {
  NextDataLayer?: DataLayerEvent[];
  dataLayer?: unknown[];
  NextDataLayerTransformFn?: (event: DataLayerEvent) => DataLayerEvent | null | undefined | false;
  nextCampaign?: { config(o: { apiKey: string }): void; event(name: string, data: object): void };
};

const EXIT_INTENT = {
  'exit-intent.shown': 'shown',
  'exit-intent.clicked': 'accepted',
  'exit-intent.dismissed': 'dismissed',
  'exit-intent.closed': 'closed',
} as const;

const NEXT_CAMPAIGN_SCRIPT = 'https://campaigns.apps.29next.com/js/v1/campaign/';
const cents = (n: number) => Math.round(n * 100) / 100;

export function startAnalytics(engine: Engine, options: AnalyticsOptions): void {
  const win = window as Win;
  win.NextDataLayer ??= [];
  win.dataLayer ??= [];
  const page = Math.random().toString(36).slice(2, 10);
  let seq = 0;

  const deliver = (event: DataLayerEvent) => {
    win.NextDataLayer!.push(event);
    win.dataLayer!.push({ ecommerce: null });
    win.dataLayer!.push(event);
  };

  const transform = (event: DataLayerEvent): DataLayerEvent | undefined => {
    const fn = win.NextDataLayerTransformFn;
    if (typeof fn !== 'function') return event;
    try {
      return fn(event) || undefined;
    } catch (err) {
      console.error('[next] NextDataLayerTransformFn failed', err);
      return undefined;
    }
  };

  const attribution = () => {
    const a = engine.attribution();
    const metadata = Object.fromEntries(
      Object.entries(a.metadata).map(([k, v]) => [
        k,
        typeof v === 'string' && /^https?:/.test(v) ? withoutQuery(v) : v,
      ]),
    );
    return { ...a, metadata };
  };

  const send = (name: string, data: object) => {
    const { campaign } = engine.getState();
    const event = transform({
      event: name,
      event_id: `${page}_${++seq}`,
      event_time: new Date().toISOString(),
      user_properties: { visitor_type: 'guest' },
      page_location: location.origin + location.pathname,
      page_title: document.title,
      page_referrer: withoutQuery(document.referrer),
      campaign_name: campaign?.name,
      campaign_currency: campaign?.currency,
      campaign_language: campaign?.language,
      attribution: attribution(),
      _metadata: { source: 'NextDataLayer', version: options.version },
      ...data,
    });
    if (event) deliver(event);
  };

  const currency = () => engine.getState().cart.summary?.currency ?? engine.getState().campaign?.currency ?? 'USD';

  const ids = (product?: number, variant?: number) => ({
    ...(product != null && { item_product_id: String(product) }),
    ...(variant != null && { item_variant_id: String(variant) }),
  });

  const item = (packageId: number, count: number, index: number, line?: SummaryLine) => {
    const pkg = engine.getPackage(packageId);
    if (!pkg) return undefined;
    const price = Number(line?.unit_price ?? pkg.price);
    const before = Number(line?.original_unit_price) || Number(pkg.price_retail) || 0;
    return {
      item_id: pkg.product_sku || String(pkg.external_id),
      item_name: pkg.product_name || pkg.name,
      item_category: engine.getState().campaign?.name,
      ...(pkg.product_variant_name && { item_variant: pkg.product_variant_name }),
      ...ids(pkg.product_id, pkg.product_variant_id),
      ...(pkg.product_sku && { item_sku: pkg.product_sku }),
      item_image: pkg.image,
      price,
      ...(before > price && { discount: cents(before - price) }),
      quantity: pkg.qty * count,
      currency: currency(),
      index,
    };
  };

  const ecommerce = (lines: Line[]) => {
    const summary = engine.getState().cart.summary;
    const items = lines
      .map((l, i) =>
        item(
          l.package_id,
          l.quantity,
          i,
          summary?.lines.find((s) => s.package_id === l.package_id),
        ),
      )
      .filter((i): i is NonNullable<typeof i> => !!i);
    return { currency: currency(), value: cents(items.reduce((n, i) => n + i.price * i.quantity, 0)), items };
  };

  const cartTotal = () => engine.getState().cart.summary?.total ?? '0';

  const exitIntent = (name: string, { imageUrl, template }: ExitIntentDetail) =>
    send(`dl_exit_intent_${name}`, {
      event_category: 'engagement',
      event_action: `exit_intent_${name}`,
      event_label: imageUrl || template || 'exit-intent',
      exit_intent: { image_url: imageUrl || '', template: template || '' },
    });

  let baseline: Line[] | undefined;

  const onReady = (lines: Line[]) => {
    baseline = lines;
    send('dl_user_data', { cart_total: cartTotal(), ecommerce: ecommerce(engine.cart.lines()) });
    const ids = [
      ...new Set(
        [...document.querySelectorAll('[data-next-package-id]')].map((el) =>
          Number(el.getAttribute('data-next-package-id')),
        ),
      ),
    ];
    const viewed = ids.filter((id) => engine.getPackage(id)).map((id) => ({ package_id: id, quantity: 1 }));
    if (viewed.length === 1) send('dl_view_item', { ecommerce: ecommerce(viewed) });
    if (viewed.length > 1) {
      send('dl_view_item_list', {
        ecommerce: { ...ecommerce(viewed), item_list_id: 'product_list', item_list_name: 'Product List' },
      });
    }
  };

  const onCartUpdated = (previous: Line[], cart: CartState) => {
    const lines = mergeLines(cart.groups);
    const before = new Map(previous.map((l) => [l.package_id, l.quantity]));
    const after = new Map(lines.map((l) => [l.package_id, l.quantity]));
    const added: Line[] = [];
    const removed: Line[] = [];
    for (const id of new Set([...before.keys(), ...after.keys()])) {
      const diff = (after.get(id) ?? 0) - (before.get(id) ?? 0);
      if (diff > 0) added.push({ package_id: id, quantity: diff });
      if (diff < 0) removed.push({ package_id: id, quantity: -diff });
    }
    baseline = lines;
    if (added.length && removed.length) {
      const a = ecommerce(added);
      const r = ecommerce(removed);
      send('dl_package_swapped', {
        ecommerce: {
          currency: a.currency,
          value_change: cents(a.value - r.value),
          items_removed: r.items,
          items_added: a.items,
        },
      });
    } else if (added.length) {
      send('dl_add_to_cart', { ecommerce: ecommerce(added) });
    } else if (removed.length) {
      send('dl_remove_from_cart', { ecommerce: ecommerce(removed) });
    }
  };

  const taxIncluded = (order: Order) => {
    for (const line of order.lines ?? []) {
      const catalog = Number(engine.getPackage(line.package ?? 0)?.price);
      const qty = line.quantity || 1;
      const incl = Number(line.price_incl_tax_excl_discounts) / qty;
      const excl = Number(line.price_excl_tax_excl_discounts) / qty;
      if (!(catalog > 0) || !Number.isFinite(incl) || !Number.isFinite(excl) || Math.abs(incl - excl) <= 0.02) continue;
      return Math.abs(incl - catalog) < Math.abs(excl - catalog);
    }
    return false;
  };

  const orderItem = (order: Order, line: OrderLine, index: number, incl: boolean) => {
    const qty = line.quantity || 1;
    const paid = Number(incl ? line.price_incl_tax : line.price_excl_tax) / qty;
    const listed = Number(incl ? line.price_incl_tax_excl_discounts : line.price_excl_tax_excl_discounts) / qty;
    return {
      item_id: line.product_sku || String(line.product_id ?? line.id),
      item_name: line.product_title,
      item_category: engine.getState().campaign?.name,
      ...(line.variant_title && { item_variant: line.variant_title }),
      ...ids(line.product_id, line.variant_id),
      ...(line.product_sku && { item_sku: line.product_sku }),
      ...(line.image && { item_image: line.image }),
      price: cents(paid),
      ...(listed > paid && { discount: cents(listed - paid) }),
      quantity: line.quantity,
      currency: order.currency ?? currency(),
      index,
    };
  };

  const onOrder = ({ order, purchase, upsells }: EventMap['order.loaded']) => {
    const reported: string[] = [];
    if (purchase) {
      const lines = (order.lines ?? []).filter((l) => !l.is_upsell);
      const incl = taxIncluded(order);
      const items = lines.map((l, i) => orderItem(order, l, i, incl));
      const discount = Number(order.total_discounts ?? 0);
      send('dl_purchase', {
        event_id: purchase,
        pageType: 'purchase',
        ecommerce: {
          currency: order.currency ?? currency(),
          transaction_id: purchase,
          value: cents(items.reduce((n, i) => n + i.price * i.quantity, 0)),
          tax: Number(order.total_tax ?? 0),
          shipping: Number((incl ? order.shipping_incl_tax : order.shipping_excl_tax) ?? 0),
          affiliation: 'Online Store',
          items,
          ...(discount > 0 && { discount }),
        },
      });
      reported.push(purchase);
    }
    for (const { id, number, line } of upsells ?? []) {
      const item = orderItem(order, line, 0, taxIncluded(order));
      const transaction = `${order.ref_id}-US${number}`;
      send('dl_upsell_purchase', {
        event_id: transaction,
        pageType: 'upsell',
        ecommerce: {
          currency: item.currency,
          transaction_id: transaction,
          value: cents(item.price * item.quantity),
          tax: 0,
          shipping: 0,
          affiliation: 'Upsell',
          items: [item],
        },
        upsell_metadata: {
          original_order_id: order.ref_id,
          upsell_number: number,
          package_id: String(line.package ?? line.product_id ?? line.id),
          package_name: line.product_title,
        },
      });
      reported.push(id);
    }
    if (reported.length) engine.order?.markReported(reported);
  };

  engine.on(
    '*',
    (e) => {
      if (e.name === 'ready') return onReady((e.data as EventMap['ready']).lines);
      if (!baseline) return;
      const cart = ecommerce(engine.cart.lines());
      const value = Number(cartTotal());
      switch (e.name) {
        case 'cart.updated':
          return onCartUpdated(baseline, (e.data as EventMap['cart.updated']).cart);
        case 'cart.calculated':
          return send('dl_cart_updated', { cart_total: cartTotal(), ecommerce: cart });
        case 'checkout.started':
          return send('dl_begin_checkout', { cart_total: cartTotal(), ecommerce: cart });
        case 'checkout.shipping-added': {
          const { tier } = e.data as EventMap['checkout.shipping-added'];
          const shipping = { ...cart, currencyCode: cart.currency, shipping_tier: tier };
          return send('dl_add_shipping_info', {
            ecommerce: shipping,
            event_category: 'ecommerce',
            event_value: value,
            shipping_tier: tier,
          });
        }
        case 'order.loaded':
          return onOrder(e.data as EventMap['order.loaded']);
        case 'upsell.viewed': {
          const { refId, page } = e.data as EventMap['upsell.viewed'];
          return send('dl_viewed_upsell', {
            order_id: refId,
            page_path: page,
            upsell: { package_id: 'page_view', package_name: 'Upsell Page View', currency: currency() },
          });
        }
        case 'upsell.skipped': {
          const { refId, packageId } = e.data as EventMap['upsell.skipped'];
          const pkg = packageId ? engine.getPackage(packageId) : undefined;
          return send('dl_skipped_upsell', {
            order_id: refId,
            upsell: {
              package_id: packageId ? String(packageId) : 'unknown',
              package_name: pkg?.name ?? (packageId ? `Package ${packageId}` : 'Unknown Package'),
            },
          });
        }
        case 'exit-intent.shown':
        case 'exit-intent.clicked':
        case 'exit-intent.dismissed':
        case 'exit-intent.closed':
          return exitIntent(EXIT_INTENT[e.name], e.data as ExitIntentDetail);
        case 'exit-intent.action': {
          const { action, couponCode } = e.data as EventMap['exit-intent.action'];
          return send('dl_exit_intent_action', {
            event_category: 'engagement',
            event_action: `exit_intent_${action}`,
            event_label: couponCode || action,
            exit_intent: { action, coupon_code: couponCode || '' },
          });
        }
        case 'checkout.payment-added': {
          const { method } = e.data as EventMap['checkout.payment-added'];
          const type = method === 'card_token' ? 'Credit Card' : method;
          return send('dl_add_payment_info', {
            ecommerce: { ...cart, payment_type: type },
            event_category: 'ecommerce',
            event_value: value,
            payment_type: type,
          });
        }
      }
    },
    { replay: true },
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
