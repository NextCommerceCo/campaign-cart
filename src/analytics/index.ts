import { mergeLines } from '../engine/cart/cart';
import type { Engine } from '../engine/engine';
import type { AnalyticsName, CartState, EventMap } from '../engine/types';
import { startLegacyDataLayer } from '../compat/analytics';
import { eventIds, pageContext } from './context';
import { cartEcommerce, cents, currency, ecommerce, type Line, orderItem, taxIncluded } from './ecommerce';

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
  const nextId = eventIds();
  const legacyExitIntent = startLegacyDataLayer(engine, {
    version: options.version,
    dataLayer: options.dataLayer,
    nextId,
  });

  const emit = (name: AnalyticsName, params: Record<string, unknown>, id?: string) => {
    const generated = nextId();
    const context = pageContext(engine);
    engine.events.emit('analytics', { name, id: id ?? generated, time: new Date().toISOString(), params, context });
  };

  let baseline: Line[] | undefined;

  const onReady = (lines: Line[]) => {
    baseline = lines;
    const { page_location, page_title, page_referrer } = pageContext(engine);
    emit('page_view', { page_location, page_title, page_referrer });
    const ids = [
      ...new Set(
        [...document.querySelectorAll('[data-next-package-id]')].map((el) =>
          Number(el.getAttribute('data-next-package-id')),
        ),
      ),
    ];
    const viewed = ids.filter((id) => engine.getPackage(id)).map((id) => ({ package_id: id, quantity: 1 }));
    if (viewed.length === 1) emit('view_item', ecommerce(engine, viewed));
    if (viewed.length > 1) {
      const { value: _, ...list } = ecommerce(engine, viewed);
      emit('view_item_list', { ...list, item_list_id: 'product_list', item_list_name: 'Product List' });
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
      const a = ecommerce(engine, added);
      const r = ecommerce(engine, removed);
      emit('swap_items', {
        currency: a.currency,
        value_change: cents(a.value - r.value),
        items_removed: r.items,
        items_added: a.items,
      });
    } else if (added.length) {
      emit('add_to_cart', ecommerce(engine, added));
    } else if (removed.length) {
      emit('remove_from_cart', ecommerce(engine, removed));
    }
  };

  const onOrder = ({ order, purchase, coupon, upsells }: EventMap['order.loaded']) => {
    const reported: string[] = [];
    if (purchase) {
      const lines = (order.lines ?? []).filter((l) => !l.is_upsell);
      const incl = taxIncluded(engine, order);
      const items = lines.map((l, i) => orderItem(engine, order, l, i, incl));
      const discount = Number(order.total_discounts ?? 0);
      emit(
        'purchase',
        {
          currency: order.currency ?? currency(engine),
          transaction_id: purchase,
          value: cents(items.reduce((n, i) => n + i.price * i.quantity, 0)),
          tax: Number(order.total_tax ?? 0),
          shipping: Number((incl ? order.shipping_incl_tax : order.shipping_excl_tax) ?? 0),
          affiliation: 'Online Store',
          items,
          ...(coupon && { coupon }),
          ...(discount > 0 && { discount }),
        },
        purchase,
      );
      reported.push(purchase);
    }
    for (const { id, number, line } of upsells ?? []) {
      const item = orderItem(engine, order, line, 0, taxIncluded(engine, order));
      const transaction = `${order.ref_id}-US${number}`;
      emit(
        'upsell_purchase',
        {
          currency: item.currency,
          transaction_id: transaction,
          value: cents(item.price * item.quantity),
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
        transaction,
      );
      reported.push(id);
    }
    if (reported.length) engine.order?.markReported(reported);
  };

  engine.on(
    '*',
    (e) => {
      if (e.name === 'ready') return onReady((e.data as EventMap['ready']).lines);
      if (!baseline) return;
      legacyExitIntent(e);
      switch (e.name) {
        case 'cart.updated':
          return onCartUpdated(baseline, (e.data as EventMap['cart.updated']).cart);
        case 'cart.calculated':
          return emit('update_cart', cartEcommerce(engine));
        case 'checkout.started':
          return emit('begin_checkout', cartEcommerce(engine));
        case 'checkout.shipping-added': {
          const { tier } = e.data as EventMap['checkout.shipping-added'];
          return emit('add_shipping_info', { ...cartEcommerce(engine), shipping_tier: tier });
        }
        case 'checkout.payment-added': {
          const { method } = e.data as EventMap['checkout.payment-added'];
          return emit('add_payment_info', {
            ...cartEcommerce(engine),
            payment_type: method === 'card_token' ? 'Credit Card' : method,
          });
        }
        case 'order.loaded':
          return onOrder(e.data as EventMap['order.loaded']);
        case 'upsell.viewed': {
          const { refId, page } = e.data as EventMap['upsell.viewed'];
          return emit('view_upsell', { order_id: refId, page_path: page, currency: currency(engine) });
        }
        case 'upsell.skipped': {
          const { refId, packageId } = e.data as EventMap['upsell.skipped'];
          const name = packageId ? engine.getPackage(packageId)?.name : undefined;
          return emit('skip_upsell', {
            order_id: refId,
            ...(packageId && { package_id: packageId }),
            ...(name && { package_name: name }),
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
