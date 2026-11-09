import { withoutQuery } from '../../engine/attribution';
import type { Engine } from '../../engine/engine';
import type { DataLayerTrace, TrackingEvent, TrackingName } from '../../engine/events/analytics';
import type { EngineEvent } from '../../engine/events/bus';
import type { EventContext } from '../../engine/events/context';
import { isLineEvent, lineBurst, type LineEvent } from './burst';
import { ecommerce } from './ga4';
import { exitIntentPushes } from './exit-intent';
import { dataLayerFields } from './pushes';

type DataLayerEvent = { event: string; event_id: string; [key: string]: unknown };
type Win = Window & {
  NextDataLayer?: DataLayerEvent[];
  dataLayer?: unknown[];
  NextDataLayerTransformFn?: (event: DataLayerEvent) => DataLayerEvent | null | undefined | false;
};
type Options = { apiKey: string; version: string; dataLayer?: boolean };

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

const transformed = (engine: Engine, win: Win, event: DataLayerEvent): DataLayerEvent | undefined => {
  const fn = win.NextDataLayerTransformFn;
  if (typeof fn !== 'function') return event;
  try {
    return fn(event) || undefined;
  } catch (err) {
    engine.log.error('NextDataLayerTransformFn failed', err);
    return undefined;
  }
};

const SHIPPING_INFO = 'dl_add_shipping_info';

/** Whether this checkout already pushed its one `dl_add_shipping_info`; marks it for the first. */
const shippingInfoOnce = (engine: Engine) => {
  const sent = new Set<string>();
  return (e: TrackingEvent) => {
    if (e.event_type !== 'checkout_shipping_address_submitted' && e.event_type !== 'checkout_shipping_method_submitted')
      return false;
    if (sent.has(e.data.id) || engine.checkout?.reported(SHIPPING_INFO)) return true;
    sent.add(e.data.id);
    engine.checkout?.markReported(SHIPPING_INFO);
    return false;
  };
};

/**
 * @deprecated 0.4.x `dl_*` events (Elevar format) on `window.NextDataLayer` and `window.dataLayer`,
 * with `window.NextDataLayerTransformFn`. Listen with `next.analytics.on('*', fn)`: the same moments
 * under the SDK's names. Returns the exit-intent handler, for the caller to run in event order.
 */
export function startLegacyDataLayer(engine: Engine, options: Options): (e: EngineEvent) => void {
  const win = window as Win;
  win.NextDataLayer ??= [];
  if (options.dataLayer !== false) win.dataLayer ??= [];
  engine.log.info('dl_* data layer events are deprecated: use next.analytics.on("*", fn)');

  const push = (name: string, id: string, time: string, context: EventContext, data: object) => {
    const event = transformed(engine, win, {
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
    if (!event) return;
    win.NextDataLayer!.push(event);
    if (options.dataLayer === false) return;
    win.dataLayer!.push({ ecommerce: null });
    win.dataLayer!.push(event);
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

  const shippingInfoSent = shippingInfoOnce(engine);
  engine.on('analytics', ({ data: e }) => {
    if (isLineEvent(e)) return burst.collect(e);
    if (shippingInfoSent(e)) {
      const skipped = 'already sent this checkout';
      const trace: DataLayerTrace = { trace: 'data_layer', name: SHIPPING_INFO, event_id: e.event_id, skipped };
      return engine.log.debug(`${SHIPPING_INFO} not sent for ${e.event_type}: ${skipped}`, trace);
    }
    const body = dataLayerFields(engine, e);
    if (!body) return engine.log.debug(`${NAMES[e.event_type]} not sent for ${e.event_type} ${e.event_id}`);
    send(NAMES[e.event_type], e.event_id, e.created_at, e.context, body);
  });

  return exitIntentPushes(engine, send);
}
