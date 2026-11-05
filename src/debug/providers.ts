import type { TrackingEvent, TrackingName } from '../engine/events/analytics';
import type { EventName } from '../engine/events/bus';
import { format } from '../engine/format';

export interface ProviderConfig {
  enabled: boolean;
  nextCampaign: boolean;
  dataLayer: boolean;
  unsupported: string[];
}

export interface Provider {
  id: string;
  status: 'ok' | 'off' | 'warn' | 'info';
  name: string;
  short: string;
  detail: string;
}

type EngineName = Exclude<EventName, 'analytics'>;
export type Line = Record<string, unknown>;
export type Layer = 'NextDataLayer' | 'dataLayer';
export type Win = Window &
  Partial<Record<Layer, unknown[]>> & {
    google_tag_manager?: Record<string, unknown>;
    nextCampaign?: { event?: unknown };
    NextDataLayerTransformFn?: unknown;
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

export const dlOf = (name: string) => WIRING.find((w) => (w.tracking ?? w.dl) === name)?.dl ?? name;

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
const NEXT_SCRIPT = 'script[src^="https://campaigns.apps.29next.com/js/v1/campaign/"]';

const wireOf = (name: string) => WIRING.find((w) => w.tracking === name);
const objectOf = (name: string) => wireOf(name)?.object;
export const ga4Of = (name: string) => wireOf(name)?.ga4;

/** The cart, checkout, order or upsell of a tracking event's `data`: what carries its lines and currency. */
export const pricedOf = (name: string, data: unknown): Line => {
  const d = (data ?? {}) as Line;
  return objectOf(name) === 'checkout' ? ((d.cart ?? {}) as Line) : d;
};

export const amount = (event: TrackingEvent) => {
  const { total, currency } = pricedOf(event.event_type, event.data);
  return typeof total === 'number'
    ? format({ type: 'money', value: total }, String(currency ?? event.context.campaign?.currency ?? ''))
    : '';
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

export function providers(config: ProviderConfig, started: boolean): Provider[] {
  const win = window as Win;
  const p = (id: string, status: Provider['status'], name: string, short: string, detail: string): Provider => ({
    id,
    status,
    name,
    short,
    detail,
  });
  const extra = [
    ...config.unsupported.map((id) => {
      const name = UNSUPPORTED[id] ?? id;
      return p(
        id,
        'warn',
        name,
        'not built in',
        `${name} is on in nextConfig, but it is not built in: send events from next.analytics.on('*', fn).`,
      );
    }),
    ...(typeof win.NextDataLayerTransformFn === 'function'
      ? [
          p(
            'transform',
            'info',
            'NextDataLayerTransformFn',
            'set',
            'NextDataLayerTransformFn can change or drop each dl_* event.',
          ),
        ]
      : []),
  ];
  if (!config.enabled) {
    const off = 'Analytics is off: nextConfig.analytics.enabled is false.';
    return [
      p('NextDataLayer', 'off', 'NextDataLayer', 'off', off),
      p('dataLayer', 'off', 'GTM dataLayer', 'off', off),
      p('listeners', 'off', 'Page scripts', 'off', off),
      p('nextCampaign', 'off', 'NEXT analytics', 'off', off),
      ...extra,
    ];
  }
  const idle = 'Starts once the page is idle.';
  const events = win.NextDataLayer?.length ?? 0;
  const count = `${events} event${events === 1 ? '' : 's'}`;
  const containers = Object.keys(win.google_tag_manager ?? {}).filter((k) => k.startsWith('GTM-'));
  return [
    started
      ? p('NextDataLayer', 'ok', 'NextDataLayer', count, `window.NextDataLayer has ${count} (dl_*).`)
      : p('NextDataLayer', 'off', 'NextDataLayer', 'waits for idle', idle),
    !config.dataLayer
      ? p('dataLayer', 'off', 'GTM dataLayer', 'off', 'Off in nextConfig: analytics.providers.gtm.enabled is false.')
      : containers.length
        ? p('dataLayer', 'ok', 'GTM dataLayer', containers[0]!, `window.dataLayer, read by ${containers.join(', ')}.`)
        : p(
            'dataLayer',
            'warn',
            'GTM dataLayer',
            'no GTM container',
            'GTM dataLayer is on, but this page has no GTM container.',
          ),
    p(
      'listeners',
      'info',
      'Page scripts',
      'next.analytics.on',
      "Page scripts get every event with next.analytics.on('*', fn).",
    ),
    !config.nextCampaign
      ? p(
          'nextCampaign',
          'off',
          'NEXT analytics',
          'off',
          'Off in nextConfig: analytics.providers.nextCampaign.enabled is false.',
        )
      : typeof win.nextCampaign?.event === 'function'
        ? p('nextCampaign', 'ok', 'NEXT analytics', 'own page_view', 'Its own script sends page_view.')
        : started
          ? p(
              'nextCampaign',
              'warn',
              'NEXT analytics',
              'not loaded',
              `NEXT analytics is on, but its script ${document.querySelector(NEXT_SCRIPT) ? 'did not load' : 'is not on the page'}.`,
            )
          : p('nextCampaign', 'off', 'NEXT analytics', 'waits for idle', idle),
    ...extra,
  ];
}
