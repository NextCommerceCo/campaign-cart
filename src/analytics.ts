import { mergeLines } from './engine/cart';
import type { Engine } from './engine/engine';

export interface AnalyticsOptions {
  apiKey: string;
  version: string;
  nextCampaign: boolean;
}

type Line = { package_id: number; quantity: number };
type DataLayerEvent = { event: string; event_id: string; [key: string]: unknown };
type Win = Window & {
  NextDataLayer?: DataLayerEvent[];
  dataLayer?: unknown[];
  NextDataLayerTransformFn?: (event: DataLayerEvent) => DataLayerEvent | null | undefined | false;
  nextCampaign?: { config(o: { apiKey: string }): void; event(name: string, data: object): void };
};

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

  const send = (name: string, data: object) => {
    const { campaign } = engine.getState();
    const event = transform({
      event: name,
      event_id: `${page}_${++seq}`,
      event_time: new Date().toISOString(),
      user_properties: { visitor_type: 'guest' },
      page_location: location.origin + location.pathname,
      page_title: document.title,
      page_referrer: document.referrer,
      campaign_name: campaign?.name,
      campaign_currency: campaign?.currency,
      campaign_language: campaign?.language,
      attribution: engine.attribution(),
      _metadata: { source: 'NextDataLayer', version: options.version },
      ...data,
    });
    if (event) deliver(event);
  };

  const currency = () => engine.getState().cart.summary?.currency ?? engine.getState().campaign?.currency ?? 'USD';

  const item = (packageId: number, count: number, index: number, unitPrice?: string) => {
    const pkg = engine.getPackage(packageId);
    if (!pkg) return undefined;
    return {
      item_id: pkg.product_sku || String(pkg.external_id),
      item_name: pkg.product_name || pkg.name,
      item_category: engine.getState().campaign?.name,
      ...(pkg.product_variant_name && { item_variant: pkg.product_variant_name }),
      item_image: pkg.image,
      price: Number(unitPrice ?? pkg.price),
      quantity: pkg.qty * count,
      currency: currency(),
      index,
    };
  };

  const ecommerce = (lines: Line[]) => {
    const summary = engine.getState().cart.summary;
    const items = lines
      .map((l, i) =>
        item(l.package_id, l.quantity, i, summary?.lines.find((s) => s.package_id === l.package_id)?.unit_price),
      )
      .filter((i): i is NonNullable<typeof i> => !!i);
    return { currency: currency(), value: cents(items.reduce((n, i) => n + i.price * i.quantity, 0)), items };
  };

  const cartTotal = () => engine.getState().cart.summary?.total ?? '0';

  let baseline: Line[] | undefined;

  engine.on(
    'ready',
    (e) => {
      baseline = e.data.lines;
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
    },
    { replay: true },
  );

  engine.on(
    'cart.updated',
    (e) => {
      if (!baseline) return;
      const lines = mergeLines(e.data.cart.groups);
      const before = new Map(baseline.map((l) => [l.package_id, l.quantity]));
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
    },
    { replay: true },
  );

  engine.on(
    'cart.calculated',
    () => baseline && send('dl_cart_updated', { cart_total: cartTotal(), ecommerce: ecommerce(engine.cart.lines()) }),
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
