import { pageContext } from '../analytics/context';
import { cents, currency, ecommerce } from '../analytics/ecommerce';
import type { Engine } from '../engine/engine';
import type { EngineEvent } from '../engine/events';
import type { AnalyticsContext, AnalyticsEvent, AnalyticsName, EventMap, ExitIntentDetail } from '../engine/types';

type DataLayerEvent = { event: string; event_id: string; [key: string]: unknown };
type Win = Window & {
  NextDataLayer?: DataLayerEvent[];
  dataLayer?: unknown[];
  NextDataLayerTransformFn?: (event: DataLayerEvent) => DataLayerEvent | null | undefined | false;
};

const NAMES: Record<AnalyticsName, string> = {
  page_view: 'dl_user_data',
  view_item: 'dl_view_item',
  view_item_list: 'dl_view_item_list',
  add_to_cart: 'dl_add_to_cart',
  remove_from_cart: 'dl_remove_from_cart',
  update_cart: 'dl_cart_updated',
  begin_checkout: 'dl_begin_checkout',
  add_shipping_info: 'dl_add_shipping_info',
  add_payment_info: 'dl_add_payment_info',
  purchase: 'dl_purchase',
  upsell_purchase: 'dl_upsell_purchase',
  view_upsell: 'dl_viewed_upsell',
  skip_upsell: 'dl_skipped_upsell',
};

const EXIT_INTENT = {
  'exit-intent.shown': 'shown',
  'exit-intent.clicked': 'accepted',
  'exit-intent.dismissed': 'dismissed',
  'exit-intent.closed': 'closed',
} as const;

const legacyCart = (engine: Engine) => {
  const summary = engine.getState().cart.summary;
  const items = engine.cart.lines().map((l) => {
    const line = summary?.lines.find((s) => s.package_id === l.package_id);
    const price = Number(line?.package_price ?? engine.getPackage(l.package_id)?.price_total ?? 0);
    return { package_id: l.package_id, quantity: l.quantity, price };
  });
  return {
    currency: currency(engine),
    items,
    total_items: items.reduce((n, i) => n + i.quantity, 0),
    total_value: cents(items.reduce((n, i) => n + i.price * i.quantity, 0)),
  };
};

/**
 * @deprecated 0.4.x `dl_*` events (Elevar format) on `window.NextDataLayer` and `window.dataLayer`,
 * with `window.NextDataLayerTransformFn`. Listen with `next.on('analytics', fn)`: the same events
 * under GA4 names. Returns the exit-intent handler, for the caller to run in event order.
 */
export function startLegacyDataLayer(
  engine: Engine,
  options: { version: string; dataLayer?: boolean; nextId: () => string },
): (e: EngineEvent) => void {
  const win = window as Win;
  win.NextDataLayer ??= [];
  if (options.dataLayer !== false) win.dataLayer ??= [];
  engine.log.info('dl_* data layer events are deprecated: use next.on("analytics", fn)');

  const deliver = (event: DataLayerEvent) => {
    win.NextDataLayer!.push(event);
    if (options.dataLayer === false) return;
    win.dataLayer!.push({ ecommerce: null });
    win.dataLayer!.push(event);
  };

  const transform = (event: DataLayerEvent): DataLayerEvent | undefined => {
    const fn = win.NextDataLayerTransformFn;
    if (typeof fn !== 'function') return event;
    try {
      return fn(event) || undefined;
    } catch (err) {
      engine.log.error('NextDataLayerTransformFn failed', err);
      return undefined;
    }
  };

  const send = (name: string, id: string, time: string, context: AnalyticsContext, data: object) => {
    const event = transform({
      event: name,
      event_id: id,
      event_time: time,
      user_properties: { visitor_type: 'guest' },
      page_location: context.page_location,
      page_title: context.page_title,
      page_referrer: context.page_referrer,
      campaign_name: context.campaign_name,
      campaign_currency: context.campaign_currency,
      campaign_language: context.campaign_language,
      attribution: context.attribution,
      _metadata: { source: 'NextDataLayer', version: options.version },
      ...data,
    });
    if (event) deliver(event);
  };

  const cartTotal = () => engine.getState().cart.summary?.total ?? '0';

  const payload = ({ name, params }: AnalyticsEvent): object => {
    switch (name) {
      case 'page_view':
        return { cart_total: cartTotal(), ecommerce: ecommerce(engine, engine.cart.lines()) };
      case 'add_to_cart': {
        const { first_in_session, ...cart } = params;
        return { ecommerce: cart, first_in_session };
      }
      case 'update_cart':
        return { cart_total: cartTotal(), ecommerce: params, cart: legacyCart(engine) };
      case 'begin_checkout':
        return { cart_total: cartTotal(), ecommerce: params };
      case 'add_shipping_info': {
        const { shipping_tier, ...cart } = params;
        return {
          ecommerce: { ...cart, currencyCode: cart.currency, shipping_tier },
          event_category: 'ecommerce',
          event_value: Number(cartTotal()),
          shipping_tier,
        };
      }
      case 'add_payment_info':
        return {
          ecommerce: params,
          event_category: 'ecommerce',
          event_value: Number(cartTotal()),
          payment_type: params.payment_type,
        };
      case 'purchase':
        return { pageType: 'purchase', ecommerce: params };
      case 'upsell_purchase': {
        const { upsell, ...rest } = params;
        return { pageType: 'upsell', ecommerce: rest, upsell_metadata: upsell };
      }
      case 'view_upsell':
        return {
          order_id: params.order_id,
          page_path: params.page_path,
          upsell: { package_id: 'page_view', package_name: 'Upsell Page View', currency: params.currency },
        };
      case 'skip_upsell': {
        const id = params.package_id;
        return {
          order_id: params.order_id,
          upsell: {
            package_id: id ? String(id) : 'unknown',
            package_name: params.package_name ?? (id ? `Package ${id}` : 'Unknown Package'),
          },
        };
      }
      default:
        return { ecommerce: params };
    }
  };

  engine.on('analytics', ({ data }: { data: AnalyticsEvent }) =>
    send(NAMES[data.name], data.id, data.time, data.context, payload(data)),
  );

  const exitIntent = (name: string, data: object) =>
    send(`dl_exit_intent_${name}`, options.nextId(), new Date().toISOString(), pageContext(engine), {
      event_category: 'engagement',
      ...data,
    });

  return (e) => {
    if (e.name in EXIT_INTENT) {
      const name = EXIT_INTENT[e.name as keyof typeof EXIT_INTENT];
      const { imageUrl, template } = e.data as ExitIntentDetail;
      exitIntent(name, {
        event_action: `exit_intent_${name}`,
        event_label: imageUrl || template || 'exit-intent',
        exit_intent: { image_url: imageUrl || '', template: template || '' },
      });
    }
    if (e.name === 'exit-intent.action') {
      const { action, couponCode } = e.data as EventMap['exit-intent.action'];
      exitIntent('action', {
        event_action: `exit_intent_${action}`,
        event_label: couponCode || action,
        exit_intent: { action, coupon_code: couponCode || '' },
      });
    }
  };
}
