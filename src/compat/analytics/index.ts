import { withoutQuery } from '../../engine/attribution';
import type { Engine } from '../../engine/engine';
import { newId } from '../../engine/id';
import { legacyRegistry } from '../legacy/registry';
import type { EngineEvent } from '../../engine/events/bus';
import type { AnalyticsTrace, DataLayerTrace, TrackingEvent, TrackingName } from '../../engine/events/analytics';
import type { EventMap, EventName } from '../../engine/events/bus';
import type { EventContext } from '../../engine/events/context';
import type { ApiOrder } from '../../engine/types';
import { isLineEvent, lineBurst, type LineEvent } from './burst';
import { cartEcommerce, currency, ecommerce, purchase, upsellPurchase, valueOf } from './ga4';
import { paymentType } from '../../engine/payment';

type DataLayerEvent = { event: string; event_id: string; [key: string]: unknown };
type Win = Window & {
  NextDataLayer?: DataLayerEvent[];
  dataLayer?: unknown[];
  NextDataLayerTransformFn?: (event: DataLayerEvent) => DataLayerEvent | null | undefined | false;
};

export const NAMES: Record<TrackingName, string> = {
  page_viewed: 'dl_user_data',
  product_viewed: 'dl_view_item',
  product_list_viewed: 'dl_view_item_list',
  product_added_to_cart: 'dl_add_to_cart',
  product_removed_from_cart: 'dl_remove_from_cart',
  cart_updated: 'dl_cart_updated',
  checkout_started: 'dl_begin_checkout',
  checkout_contact_info_submitted: 'dl_generate_lead',
  checkout_shipping_address_submitted: 'dl_add_shipping_info',
  checkout_shipping_method_submitted: 'dl_add_shipping_info',
  checkout_payment_info_submitted: 'dl_add_payment_info',
  checkout_completed: 'dl_purchase',
  upsell_completed: 'dl_upsell_purchase',
  upsell_viewed: 'dl_viewed_upsell',
  upsell_skipped: 'dl_skipped_upsell',
  promotion_viewed: 'dl_view_promotion',
  promotion_selected: 'dl_select_promotion',
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

const dataLayerCart = (engine: Engine) => {
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
    total_value: valueOf(items),
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

/** The order as the Campaigns API returned it, for the prices before tax the public Order leaves out. */
const rawOrder = (engine: Engine, refId: string): ApiOrder | undefined => {
  const { paidOrder, order } = engine.getState().order ?? {};
  return [paidOrder, order].find((o) => o?.ref_id === refId);
};

/**
 * @deprecated 0.4.x `dl_*` events (Elevar format) on `window.NextDataLayer` and `window.dataLayer`,
 * with `window.NextDataLayerTransformFn`. Listen with `next.analytics.on('*', fn)`: the same moments
 * under the SDK's names. Returns the exit-intent handler, for the caller to run in event order.
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

  const push = (name: string, id: string, time: string, context: EventContext, data: object) => {
    const event = transform({
      event: name,
      event_id: id,
      event_time: time,
      user_properties: { visitor_type: 'guest' },
      page_location: context.page_location,
      page_title: context.page_title,
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

  const burst = lineBurst((lines) => {
    const [first] = lines as [LineEvent, ...LineEvent[]];
    const cart = ecommerce(
      engine,
      lines.map((e) => e.data),
    );
    const first_in_session = lines.some((e) => 'first_in_session' in e.data && e.data.first_in_session);
    const body =
      first.event_type === 'product_added_to_cart' ? { ecommerce: cart, first_in_session } : { ecommerce: cart };
    push(NAMES[first.event_type], first.event_id, first.created_at, first.context, body);
  });

  const send = (name: string, id: string, time: string, context: EventContext, data: object) => {
    burst.flush();
    push(name, id, time, context, data);
  };

  const cartTotal = () => engine.getState().cart.summary?.total ?? '0';

  const SHIPPING_INFO = 'dl_add_shipping_info';
  const shippingSent = new Set<string>();
  const shippingInfoSent = (e: TrackingEvent) => {
    if (e.event_type !== 'checkout_shipping_address_submitted' && e.event_type !== 'checkout_shipping_method_submitted')
      return false;
    if (shippingSent.has(e.data.id) || engine.checkout?.reported(SHIPPING_INFO)) return true;
    shippingSent.add(e.data.id);
    engine.checkout?.markReported(SHIPPING_INFO);
    return false;
  };

  const payload = (e: Exclude<TrackingEvent, LineEvent>): object | undefined => {
    switch (e.event_type) {
      case 'page_viewed':
        return { cart_total: cartTotal(), ecommerce: ecommerce(engine, engine.cart.current().lines) };
      case 'product_viewed':
        return { ecommerce: ecommerce(engine, [e.data]) };
      case 'product_list_viewed': {
        const { value: _, ...list } = ecommerce(engine, e.data);
        return { ecommerce: { ...list, item_list_id: 'product_list', item_list_name: 'Product List' } };
      }
      case 'cart_updated':
        return { cart_total: cartTotal(), ecommerce: cartEcommerce(engine, e.data), cart: dataLayerCart(engine) };
      case 'checkout_started':
        return { cart_total: cartTotal(), ecommerce: cartEcommerce(engine, e.data.cart) };
      case 'checkout_contact_info_submitted': {
        const { currency, value } = cartEcommerce(engine, e.data.cart);
        return { currency, value, lead_source: 'checkout' };
      }
      case 'checkout_shipping_address_submitted':
      case 'checkout_shipping_method_submitted': {
        const cart = cartEcommerce(engine, e.data.cart);
        const shipping_tier = e.data.cart.shipping_method?.name ?? 'Standard';
        return {
          ecommerce: { ...cart, currencyCode: cart.currency, shipping_tier },
          event_category: 'ecommerce',
          event_value: Number(cartTotal()),
          shipping_tier,
        };
      }
      case 'checkout_payment_info_submitted': {
        const method = e.data.payment_method;
        const payment_type = paymentType(method);
        return {
          ecommerce: { ...cartEcommerce(engine, e.data.cart), payment_type },
          event_category: 'ecommerce',
          event_value: Number(cartTotal()),
          payment_type,
        };
      }
      case 'checkout_completed': {
        const order = rawOrder(engine, e.data.ref_id);
        if (!order) return undefined;
        const coupon = engine.getState().order?.coupon;
        const code = coupon?.refId === order.ref_id ? coupon.code : undefined;
        return { pageType: 'purchase', ecommerce: purchase(engine, order, e.event_id, code) };
      }
      case 'upsell_completed': {
        const order = rawOrder(engine, e.data.ref_id);
        const line = order?.lines?.find((l) => String(l.id) === e.data.upsell.line.id);
        if (!order || !line) return undefined;
        return {
          pageType: 'upsell',
          ecommerce: upsellPurchase(engine, order, line, e.event_id),
          upsell_metadata: {
            original_order_id: order.ref_id,
            upsell_number: e.data.upsell.number,
            package_id: String(line.package ?? line.product_id ?? line.id),
            package_name: line.product_title,
          },
        };
      }
      case 'upsell_viewed':
        return {
          order_id: e.data.ref_id,
          page_path: e.data.page,
          upsell: { package_id: 'page_view', package_name: 'Upsell Page View', currency: currency(engine) },
        };
      case 'upsell_skipped': {
        const id = e.data.lines[0]?.package_id;
        const name = id ? engine.getPackage(id)?.name : undefined;
        return {
          order_id: e.data.ref_id,
          upsell: {
            package_id: id ? String(id) : 'unknown',
            package_name: name ?? (id ? `Package ${id}` : 'Unknown Package'),
          },
        };
      }
      case 'promotion_viewed':
      case 'promotion_selected': {
        const { id, name, creative } = e.data;
        return { ecommerce: { promotion_id: id, ...(name && { promotion_name: name }), creative_name: creative } };
      }
    }
  };

  engine.on('analytics', ({ data: e }) => {
    if (isLineEvent(e)) return burst.collect(e);
    if (shippingInfoSent(e)) {
      const skipped = 'already sent this checkout';
      const trace: DataLayerTrace = { trace: 'data_layer', name: SHIPPING_INFO, event_id: e.event_id, skipped };
      return engine.log.debug(`${SHIPPING_INFO} not sent for ${e.event_type}: ${skipped}`, trace);
    }
    const body = payload(e);
    if (!body) return engine.log.debug(`${NAMES[e.event_type]} not sent for ${e.event_type} ${e.event_id}`);
    send(NAMES[e.event_type], e.event_id, e.created_at, e.context, body);
  });

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
