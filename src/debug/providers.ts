import type { DestinationTrace, TrackingName } from '../engine/events/analytics';
import type { EventName } from '../engine/events/bus';

export interface ProviderConfig {
  enabled: boolean;
  nextCampaign: boolean;
  dataLayer: boolean;
  unsupported: string[];
  /** 0.4.x `analytics.providers.facebook`; `analytics.destinations.meta` wins over it. */
  meta?: boolean;
  /** 0.4.x `analytics.providers.rudderstack`; `analytics.destinations.rudderstack` wins over it. */
  rudderstack?: boolean;
  /** `?ignore=true` is on this tab. */
  ignored?: boolean;
}

export type Place = Layer | DestinationTrace['destination'];

export interface Destination {
  place: Place;
  on: boolean;
  /** On, but what it sends through is not on this page. */
  missing?: string;
  /** Why it is off or missing, or a note on it. */
  title?: string;
}

type EngineName = Exclude<EventName, 'analytics'>;
export type Line = Record<string, unknown>;
export type Layer = 'NextDataLayer' | 'dataLayer';
type Switch = { enabled?: boolean } | undefined;
export type Win = Window &
  Partial<Record<Layer, unknown[]>> & {
    google_tag_manager?: Record<string, unknown>;
    nextCampaign?: { event?: unknown };
    NextDataLayerTransformFn?: unknown;
    nextConfig?: { analytics?: { destinations?: Partial<Record<'gtm' | 'ga4' | 'meta' | 'rudderstack', Switch>> } };
    gtag?: unknown;
    fbq?: unknown;
    rudderanalytics?: unknown;
  };

export interface Wire {
  from: EngineName[];
  tracking?: TrackingName;
  /** The envelope's `object`, as `OBJECTS` in `src/engine/events/analytics.ts`. */
  object?: string;
  /** The GA4 event the tracking event is sent as. */
  ga4?: string;
  dl: string;
}

export const WIRING: Wire[] = [
  { from: ['sdk.ready'], tracking: 'page_viewed', object: 'page', ga4: 'page_view', dl: 'dl_user_data' },
  { from: ['sdk.ready'], tracking: 'product_viewed', object: 'product', ga4: 'view_item', dl: 'dl_view_item' },
  {
    from: ['sdk.ready'],
    tracking: 'product_list_viewed',
    object: 'products',
    ga4: 'view_item_list',
    dl: 'dl_view_item_list',
  },
  {
    from: ['sdk.ready', 'cart.calculated'],
    tracking: 'product_added_to_cart',
    object: 'cart_line',
    ga4: 'add_to_cart',
    dl: 'dl_add_to_cart',
  },
  {
    from: ['sdk.ready', 'cart.calculated', 'cart.updated'],
    tracking: 'product_removed_from_cart',
    object: 'cart_line',
    ga4: 'remove_from_cart',
    dl: 'dl_remove_from_cart',
  },
  { from: ['cart.calculated'], tracking: 'cart_updated', object: 'cart', ga4: 'update_cart', dl: 'dl_cart_updated' },
  {
    from: ['checkout.started'],
    tracking: 'checkout_started',
    object: 'checkout',
    ga4: 'begin_checkout',
    dl: 'dl_begin_checkout',
  },
  {
    from: ['user.created'],
    tracking: 'checkout_contact_info_submitted',
    object: 'checkout',
    ga4: 'generate_lead',
    dl: 'dl_generate_lead',
  },
  {
    from: ['address.entered'],
    tracking: 'checkout_shipping_address_submitted',
    object: 'checkout',
    ga4: 'add_shipping_info',
    dl: 'dl_add_shipping_info',
  },
  {
    from: ['shipping.settled'],
    tracking: 'checkout_shipping_method_submitted',
    object: 'checkout',
    ga4: 'add_shipping_info',
    dl: 'dl_add_shipping_info',
  },
  {
    from: ['checkout.submitted'],
    tracking: 'checkout_payment_info_submitted',
    object: 'checkout',
    ga4: 'add_payment_info',
    dl: 'dl_add_payment_info',
  },
  {
    from: ['order.paid', 'order.loaded'],
    tracking: 'checkout_completed',
    object: 'order',
    ga4: 'purchase',
    dl: 'dl_purchase',
  },
  {
    from: ['order.loaded'],
    tracking: 'upsell_completed',
    object: 'order',
    ga4: 'purchase',
    dl: 'dl_upsell_purchase',
  },
  { from: ['upsell.viewed'], tracking: 'upsell_viewed', object: 'upsell', ga4: 'view_upsell', dl: 'dl_viewed_upsell' },
  {
    from: ['upsell.skipped'],
    tracking: 'upsell_skipped',
    object: 'upsell',
    ga4: 'skip_upsell',
    dl: 'dl_skipped_upsell',
  },
  {
    from: ['promotion.viewed'],
    tracking: 'promotion_viewed',
    object: 'promotion',
    ga4: 'view_promotion',
    dl: 'dl_view_promotion',
  },
  {
    from: ['promotion.clicked'],
    tracking: 'promotion_selected',
    object: 'promotion',
    ga4: 'select_promotion',
    dl: 'dl_select_promotion',
  },
  { from: ['promotion.viewed'], dl: 'dl_exit_intent_shown' },
  { from: ['promotion.clicked'], dl: 'dl_exit_intent_accepted' },
  { from: ['promotion.clicked'], dl: 'dl_exit_intent_action' },
  { from: ['promotion.closed'], dl: 'dl_exit_intent_dismissed' },
  { from: ['promotion.closed'], dl: 'dl_exit_intent_closed' },
];

const NEEDS_LINES: ReadonlySet<string> = new Set<TrackingName>([
  'product_viewed',
  'product_list_viewed',
  'product_added_to_cart',
  'product_removed_from_cart',
  'checkout_started',
  'checkout_shipping_address_submitted',
  'checkout_shipping_method_submitted',
  'checkout_payment_info_submitted',
  'checkout_completed',
  'upsell_completed',
]);
const PRICED: ReadonlySet<string> = new Set(['cart', 'checkout', 'order', 'upsell']);
const ORDERS: ReadonlySet<string> = new Set<TrackingName>(['checkout_completed', 'upsell_completed']);
const UNSUPPORTED: Record<string, string> = { custom: 'Custom endpoint' };
const TAGS: Record<Place, string> = {
  NextDataLayer: 'NEXT script',
  dataLayer: 'GTM container',
  ga4: 'gtag',
  meta: 'fbq',
  rudderstack: 'rudderanalytics',
};
const NEXT_SCRIPT = 'script[src^="https://campaigns.apps.29next.com/js/v1/campaign/"]';

const wireOf = (name: string) => WIRING.find((w) => w.tracking === name);
const objectOf = (name: string) => wireOf(name)?.object;

/** The cart, checkout, order or upsell of a tracking event's `data`: what carries its lines and currency. */
export const pricedOf = (name: string, data: unknown): Line => {
  const d = (data ?? {}) as Line;
  return objectOf(name) === 'checkout' ? ((d.cart ?? {}) as Line) : d;
};

export const linesOf = (name: string, data: unknown): Line[] => {
  const object = objectOf(name);
  const lines =
    object === 'product' || object === 'cart_line' ? [data] : object === 'products' ? data : pricedOf(name, data).lines;
  return Array.isArray(lines) ? (lines as Line[]) : [];
};

export function checks(name: string, data: unknown): string[] {
  const lines = linesOf(name, data);
  const priced = pricedOf(name, data);
  return [
    NEEDS_LINES.has(name) && !lines.length && 'lines is empty',
    lines.some((l) => !l.product_title) && 'a line has no product_title',
    PRICED.has(objectOf(name) ?? '') && !priced.currency && 'no currency',
    ORDERS.has(name) && !priced.number && `${name} has no order number`,
  ].filter((p): p is string => !!p);
}

export const analyticsOff = (config: ProviderConfig): string | undefined =>
  !config.enabled
    ? 'Analytics is off: nextConfig.analytics.enabled is false.'
    : config.ignored
      ? 'Analytics is off for this tab: ?ignore=true. Open a page with ?ignore=false to turn it back on.'
      : undefined;

export const unsupportedNotes = (config: ProviderConfig) =>
  config.unsupported.map(
    (id) =>
      `${UNSUPPORTED[id] ?? id} is on in nextConfig, but it is not built in: send events from next.analytics.on('*', fn).`,
  );

/** Each place a tracking event can go, on or off as the analytics chunk decides (`readDestinations`). */
export function destinations(config: ProviderConfig, started: boolean): Destination[] {
  const win = window as Win;
  const set = win.nextConfig?.analytics?.destinations ?? {};
  const off = analyticsOff(config);
  const gtm = Object.keys(win.google_tag_manager ?? {}).some((k) => k.startsWith('GTM-'));
  const script = document.querySelector(NEXT_SCRIPT) ? 'did not load' : 'is not on the page';
  const turnOn = (name: string, legacy?: string) =>
    `${name} is off: turn it on with analytics.destinations.${name.toLowerCase()}.enabled${legacy ? ` (0.4.x: analytics.providers.${legacy}.enabled)` : ''} in nextConfig.`;
  const place = (place: Place, on: boolean, tag: boolean, why: string): Destination =>
    off
      ? { place, on: false, title: off }
      : !on
        ? { place, on, title: why }
        : tag
          ? { place, on }
          : { place, on, missing: TAGS[place], title: why };
  const gtmOn = set.gtm?.enabled ?? config.dataLayer;
  const ga4On = set.ga4?.enabled === true;
  const metaOn = set.meta?.enabled ?? config.meta === true;
  const rudderOn = set.rudderstack?.enabled ?? config.rudderstack === true;
  return [
    {
      ...place(
        'NextDataLayer',
        true,
        !config.nextCampaign || !started || typeof win.nextCampaign?.event === 'function',
        `NEXT analytics is on, but its script ${script}.`,
      ),
      ...(!off &&
        !config.nextCampaign && {
          title: 'NEXT analytics is off: analytics.providers.nextCampaign.enabled is false in nextConfig.',
        }),
    },
    place(
      'dataLayer',
      gtmOn,
      gtm,
      gtmOn
        ? 'GTM dataLayer is on, but this page has no GTM container.'
        : `GTM tags get none of these events: analytics.${set.gtm?.enabled === false ? 'destinations' : 'providers'}.gtm.enabled is false in nextConfig.`,
    ),
    place(
      'ga4',
      ga4On,
      typeof win.gtag === 'function',
      ga4On ? 'GA4 is on, but this page has no Google tag (gtag).' : turnOn('GA4'),
    ),
    place(
      'meta',
      metaOn,
      typeof win.fbq === 'function',
      metaOn ? 'Meta is on, but this page has no Meta Pixel (fbq).' : turnOn('Meta', 'facebook'),
    ),
    place(
      'rudderstack',
      rudderOn,
      !!win.rudderanalytics,
      rudderOn ? 'RudderStack is on, but this page has no rudderanalytics.' : turnOn('RudderStack', 'rudderstack'),
    ),
  ];
}
