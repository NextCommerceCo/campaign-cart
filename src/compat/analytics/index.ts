import { type Attribution, withoutQuery } from '../../engine/visit/attribution';
import type { Engine } from '../../engine/engine';
import type { TrackingEvent, TrackingName } from '../../engine/events/analytics';
import type { EngineEvent } from '../../engine/events/bus';
import type { EventContext } from '../../engine/events/context';
import { createOnce, startDestination } from '../../engine/tracking';
import { exitIntentPushes } from './exit-pushes';
import { dataLayerFields, type Fields, isLineEvent, lineFields, type LineEvent } from './pushes';
import type { DataLayerName, DataLayerPush } from './schema';

type Win = Window & {
  NextDataLayer?: DataLayerPush[];
  dataLayer?: unknown[];
  NextDataLayerTransformFn?: (event: DataLayerPush) => DataLayerPush | null | undefined | false;
};
type Options = { apiKey: string; version: string; dataLayer?: boolean };

export const NAMES = {
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
} as const satisfies Record<TrackingName, DataLayerName>;

/** Builds one `dl_*` push: the fields every push carries, then the event's own. */
type Push = <N extends DataLayerName>(
  name: N,
  id: string,
  time: string,
  context: EventContext,
  fields: Fields<N>,
) => DataLayerPush & Fields<N>;

const legacyAttribution = (engine: Engine): Attribution => {
  const attribution = engine.attribution();
  const metadata = Object.fromEntries(
    Object.entries(attribution.metadata).map(([k, v]) => [
      k,
      typeof v === 'string' && /^https?:/.test(v) ? withoutQuery(v) : v,
    ]),
  );
  return { ...attribution, metadata };
};

const transformed = (engine: Engine, win: Win, event: DataLayerPush): DataLayerPush | undefined => {
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

const isShippingStep = (e: TrackingEvent) =>
  e.event_type === 'checkout_shipping_address_submitted' || e.event_type === 'checkout_shipping_method_submitted';

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
  const once = createOnce(engine);

  const push: Push = (name, id, time, context, fields) => ({
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
    ...fields,
  });

  const deliver = startDestination<Win, DataLayerPush>(engine, {
    destination: 'NextDataLayer',
    vendor: () => win,
    failed: 'dl_* data layer push failed',
    skip: (e) =>
      isShippingStep(e) && !once('checkout', SHIPPING_INFO)
        ? { name: SHIPPING_INFO, reason: 'already sent this checkout' }
        : undefined,
    calls: (e) => {
      const fields = dataLayerFields(engine, e as Exclude<TrackingEvent, LineEvent>);
      if (fields) return [push(NAMES[e.event_type], e.event_id, e.created_at, e.context, fields)];
      engine.log.debug(`${NAMES[e.event_type]} not sent for ${e.event_type} ${e.event_id}`);
      return [];
    },
    burst: {
      of: isLineEvent,
      calls: (run) => {
        const lines = run as [LineEvent, ...LineEvent[]];
        const [first] = lines;
        return [
          push(NAMES[first.event_type], first.event_id, first.created_at, first.context, lineFields(engine, lines)),
        ];
      },
    },
    send: (w, event) => {
      const out = transformed(engine, w, event);
      if (!out) return false;
      w.NextDataLayer!.push(out);
      if (options.dataLayer === false) return;
      w.dataLayer!.push({ ecommerce: null });
      w.dataLayer!.push(out);
    },
    trace: (event) => ({
      name: event.event,
      payload: { ...event, user_properties: { visitor_type: event.user_properties.visitor_type } },
    }),
    replay: false,
  });

  return exitIntentPushes(engine, (name, id, time, context, fields) =>
    deliver([push(name, id, time, context, fields)], { event_id: id }),
  );
}
