import type { AnalyticsName, EventName } from '../engine/events';

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
export type Item = Record<string, unknown>;
export type Layer = 'NextDataLayer' | 'dataLayer';
export type Win = Window &
  Partial<Record<Layer, unknown[]>> & {
    google_tag_manager?: Record<string, unknown>;
    nextCampaign?: { event?: unknown };
    NextDataLayerTransformFn?: unknown;
  };

export interface Wire {
  from: EngineName[];
  ga?: AnalyticsName;
  dl?: string;
}

export const WIRING: Wire[] = [
  { from: ['sdk.ready'], ga: 'page_view', dl: 'dl_user_data' },
  { from: ['sdk.ready'], ga: 'view_item', dl: 'dl_view_item' },
  { from: ['sdk.ready'], ga: 'view_item_list', dl: 'dl_view_item_list' },
  { from: ['sdk.ready', 'cart.calculated'], ga: 'add_to_cart', dl: 'dl_add_to_cart' },
  { from: ['sdk.ready', 'cart.calculated', 'cart.updated'], ga: 'remove_from_cart', dl: 'dl_remove_from_cart' },
  { from: ['cart.calculated'], ga: 'update_cart', dl: 'dl_cart_updated' },
  { from: ['checkout.started'], ga: 'begin_checkout', dl: 'dl_begin_checkout' },
  { from: ['contact.entered'], ga: 'generate_lead' },
  { from: ['address.entered', 'shipping.selected'], ga: 'add_shipping_info', dl: 'dl_add_shipping_info' },
  { from: ['checkout.submitted'], ga: 'add_payment_info', dl: 'dl_add_payment_info' },
  { from: ['order.loaded'], ga: 'purchase', dl: 'dl_purchase' },
  { from: ['order.loaded'], ga: 'upsell_purchase', dl: 'dl_upsell_purchase' },
  { from: ['upsell.viewed'], ga: 'view_upsell', dl: 'dl_viewed_upsell' },
  { from: ['upsell.skipped'], ga: 'skip_upsell', dl: 'dl_skipped_upsell' },
  { from: ['promotion.viewed'], ga: 'view_promotion' },
  { from: ['promotion.clicked'], ga: 'select_promotion' },
  { from: ['promotion.viewed'], dl: 'dl_exit_intent_shown' },
  { from: ['promotion.clicked'], dl: 'dl_exit_intent_accepted' },
  { from: ['promotion.clicked'], dl: 'dl_exit_intent_action' },
  { from: ['promotion.closed'], dl: 'dl_exit_intent_dismissed' },
  { from: ['promotion.closed'], dl: 'dl_exit_intent_closed' },
];

export const dlOf = (name: string) => {
  const wire = WIRING.find((w) => (w.ga ?? w.dl) === name);
  return wire ? wire.dl : name;
};

const NEEDS_ITEMS = new Set([
  'view_item',
  'view_item_list',
  'add_to_cart',
  'remove_from_cart',
  'begin_checkout',
  'add_shipping_info',
  'add_payment_info',
  'purchase',
  'upsell_purchase',
]);
const UNSUPPORTED: Record<string, string> = {
  facebook: 'Meta Pixel',
  rudderstack: 'RudderStack',
  custom: 'Custom endpoint',
};
const NEXT_SCRIPT = 'script[src^="https://campaigns.apps.29next.com/js/v1/campaign/"]';

export const itemsOf = (params: Record<string, unknown>) =>
  Array.isArray(params.items) ? (params.items as Item[]) : [];

export function checks(name: string, params: Record<string, unknown>): string[] {
  const items = Array.isArray(params.items) ? (params.items as Item[]) : undefined;
  return [
    NEEDS_ITEMS.has(name) && !items?.length && 'items is empty',
    items?.some((i) => !i.item_id && !i.item_name) && 'an item has neither item_id nor item_name',
    params.value !== undefined && !params.currency && 'value is set without currency',
    name.endsWith('purchase') && !params.transaction_id && 'transaction_id is missing',
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
        `${name} is on in nextConfig, but the SDK no longer sends to it. Add it as a GTM tag.`,
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
      "next.on('analytics')",
      "Page scripts get every event with next.on('analytics', fn).",
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
