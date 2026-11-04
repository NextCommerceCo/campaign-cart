import { cents, currency, ecommerce } from '../analytics/ecommerce';
import { withoutQuery } from '../engine/attribution';
import type { Engine } from '../engine/engine';
import { newId } from '../engine/id';
import { legacyRegistry } from './legacy';
import type { EngineEvent } from '../engine/events';
import type {
  EventContext,
  AnalyticsEvent,
  AnalyticsName,
  AnalyticsTrace,
  EventMap,
  EventName,
} from '../engine/events';

type DataLayerEvent = { event: string; event_id: string; [key: string]: unknown };
type Win = Window & {
  NextDataLayer?: DataLayerEvent[];
  dataLayer?: unknown[];
  NextDataLayerTransformFn?: (event: DataLayerEvent) => DataLayerEvent | null | undefined | false;
};

export const NAMES: Record<AnalyticsName, string> = {
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
  generate_lead: 'dl_generate_lead',
  view_promotion: 'dl_view_promotion',
  select_promotion: 'dl_select_promotion',
};

export const EXIT_INTENT: Array<[EventName, string]> = [
  ['promotion.viewed', 'shown'],
  ['promotion.clicked', 'accepted'],
  ['promotion.clicked', 'action'],
  ['promotion.closed', 'dismissed'],
  ['promotion.closed', 'closed'],
];

const CLOSED: Partial<Record<EventMap['promotion.closed']['reason'], string>> = {
  dismissed: 'dismissed',
  close_button: 'closed',
};

type PopupEvent = EventMap['promotion.clicked'] & Partial<EventMap['promotion.closed']>;

/** 0.4.43's `exit-intent:*` moments: a close or apply-coupon button's action as it is clicked; a custom one is `customAction`. */
const exitIntentName = (e: EngineEvent): string | undefined => {
  const { type, action, coupon_code, reason } = e.data as PopupEvent;
  if (!e.name.startsWith('promotion.') || type !== 'exit_intent') return undefined;
  if (e.name === 'promotion.viewed') return 'shown';
  if (e.name === 'promotion.clicked') {
    if (!action) return 'accepted';
    return action === 'close' || (action === 'apply-coupon' && coupon_code) ? 'action' : undefined;
  }
  return CLOSED[reason!];
};

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

const legacyAttribution = (engine: Engine) => {
  const attribution = engine.attribution();
  const metadata = Object.fromEntries(
    Object.entries(attribution.metadata).map(([k, v]) => [
      k,
      typeof v === 'string' && /^https?:/.test(v) ? withoutQuery(v) : v,
    ]),
  );
  return { ...attribution, metadata };
};

/**
 * @deprecated 0.4.x `dl_*` events (Elevar format) on `window.NextDataLayer` and `window.dataLayer`,
 * with `window.NextDataLayerTransformFn`. Listen with `next.analytics.on('*', fn)`: the same events
 * under GA4 names. Returns the exit-intent handler, for the caller to run in event order.
 */
export function startLegacyDataLayer(
  engine: Engine,
  options: { apiKey: string; version: string; dataLayer?: boolean },
): (e: EngineEvent) => void {
  const win = window as Win;
  win.NextDataLayer ??= [];
  if (options.dataLayer !== false) win.dataLayer ??= [];
  engine.log.info('dl_* data layer events are deprecated: use next.analytics.on("*", fn)');

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

  const send = (name: string, id: string, time: string, context: EventContext, data: object) => {
    const event = transform({
      event: name,
      event_id: id,
      event_time: time,
      user_properties: { visitor_type: 'guest' },
      page_location: context.page_location,
      page_title: document.title,
      page_referrer: context.page_referrer,
      campaign_id: context.campaign && String(context.campaign.id),
      campaign_name: context.campaign?.name,
      campaign_currency: context.campaign?.currency,
      campaign_language: context.campaign?.language,
      campaign_api_key: options.apiKey,
      campaign_session_id: context.session_id,
      attribution: legacyAttribution(engine),
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
      case 'generate_lead':
        return params;
      default:
        return { ecommerce: params };
    }
  };

  engine.on('analytics', ({ data }: { data: AnalyticsEvent }) =>
    send(NAMES[data.name], data.id, data.time, data.context, payload(data)),
  );

  const exitIntent = (trigger: EventName, name: string, data: object) => {
    const event = `dl_exit_intent_${name}`;
    const id = newId();
    send(event, id, new Date().toISOString(), engine.eventContext(), { event_category: 'engagement', ...data });
    const reason = 'Data layer only: there is no analytics event';
    const trace: AnalyticsTrace = { trace: 'analytics', trigger, name: event, sent: true, reason, id };
    engine.log.debug(`analytics ${event} sent: ${reason}`, trace);
  };

  const acted = (action: string, coupon_code = '') =>
    exitIntent('promotion.clicked', 'action', {
      event_action: `exit_intent_${action}`,
      event_label: coupon_code || action,
      exit_intent: { action, coupon_code },
    });
  const registry = legacyRegistry(engine);
  registry.customAction = () => acted('custom');

  return (e) => {
    const name = exitIntentName(e);
    if (!name) return;
    const { id, action, coupon_code } = e.data as PopupEvent;
    if (name === 'action') return acted(action!, coupon_code);
    const { imageUrl = '', template = '' } = registry.popups[id] ?? {};
    exitIntent(e.name, name, {
      event_action: `exit_intent_${name}`,
      event_label: imageUrl || template || 'exit-intent',
      exit_intent: { image_url: imageUrl, template },
    });
  };
}
