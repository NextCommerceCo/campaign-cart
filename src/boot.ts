import { bindAll } from './bindings';
import { pageEnvironment } from './bindings/environment';
import type { BootConfig } from './config';
import { Engine } from './engine/engine';
import type { EngineEvent } from './engine/events';
import type { Logger } from './engine/log';
import { funnelFromPath, storageScope } from './engine/scope';
import type { CartLine } from './engine/cart/types';
import type { AnalyticsEvent, AnalyticsName, EventContext, EventMap, EventName } from './engine/events';
import type { Campaign } from './engine/types';
import {
  announceLegacyReady,
  legacyAnalytics,
  LEGACY_EVENTS,
  RETIRED_EVENTS,
  readLegacyAnalytics,
  legacyApi,
  type LegacyApi,
  removeLegacyPersonalData,
} from './compat/legacy';

declare const __VERSION__: string;

const ORDER_MARKUP =
  '[data-next-upsell], [data-next-order-items], [data-next-display^="order."], [data-next-show^="order."], [data-next-hide^="order."]';

const browserStorage = (get: () => Storage): Storage | null => {
  try {
    return get();
  } catch {
    return null;
  }
};

const cookie = (name: string) => document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`))?.[1];

const pixelId = () =>
  document.querySelector<HTMLMetaElement>('meta[name="os-facebook-pixel"], meta[name="facebook-pixel-id"]')?.content ||
  [...document.scripts].map((s) => s.text.match(/fbq\s*\(\s*['"]init['"],\s*['"](\d+)['"]/)?.[1]).find(Boolean);

const EVENT_NAMES: EventName[] = [
  'sdk.ready',
  'sdk.error',
  'selector.selected',
  'selector.deselected',
  'selector.calculating',
  'selector.calculated',
  'cart.updated',
  'cart.calculating',
  'cart.calculated',
  'cart.added',
  'cart.removed',
  'coupon.applied',
  'coupon.removed',
  'coupon.denied',
  'checkout.started',
  'user.created',
  'user.updated',
  'address.entered',
  'address.updated',
  'shipping.selected',
  'payment.selected',
  'checkout.submitted',
  'order.created',
  'order.failed',
  'order.loaded',
  'order.paid',
  'upsell.viewed',
  'upsell.accepted',
  'upsell.skipped',
  'upsell.failed',
  'promotion.viewed',
  'promotion.clicked',
  'promotion.closed',
  'analytics',
];
const REPLAYED: EventName[] = ['sdk.ready', 'campaign.loaded', 'analytics'];

export interface SdkEvent<K extends EventName = EventName> {
  event_id: string;
  event_type: K;
  object: string;
  data: EventMap[K];
  created_at: string;
  /** The campaign session: the `ncsid` the NEXT analytics script and the Campaigns API share. */
  session_id: string;
  sdk_version: string;
}

const envelope = <K extends EventName>(e: EngineEvent<K>, engine: Engine): SdkEvent<K> => ({
  event_id: e.id,
  event_type: e.name,
  object: e.name.split('.')[0]!,
  data: e.data,
  created_at: new Date(e.at).toISOString(),
  session_id: engine.sessionId(),
  sdk_version: __VERSION__,
});

export interface NextApi extends LegacyApi {
  version: string;
  on<K extends EventName>(name: K | 'ready' | '*', fn: (data: EventMap[K], event: SdkEvent<K>) => void): () => void;
  analytics: {
    on(name: AnalyticsName | '*', fn: (event: AnalyticsEvent) => void): () => void;
  };
  getState: Engine['getState'];
  /** The page, campaign, session, attribution and browser now, as on tracking events. */
  context(): EventContext;
  log: Pick<Logger, 'level' | 'entries' | 'stream'>;
  bind(root: ParentNode): void;
  actions: {
    addItem(packageId: number, quantity?: number): Promise<void>;
    removeItem(packageId: number): Promise<void>;
    setQuantity(packageId: number, quantity: number): Promise<void>;
    clear(): Promise<void>;
    applyCoupon(code: string): Promise<boolean>;
    removeCoupon(code: string): Promise<void>;
    setShipping(shippingId: number | undefined): Promise<void>;
    setGroup(id: string, group: { lines: CartLine[]; vouchers?: string[] } | null): Promise<void>;
  };
}

/** @internal */
export function boot(config: BootConfig, campaign: Promise<Campaign>): NextApi {
  const html = document.documentElement;
  const params = new URLSearchParams(location.search);
  const funnel = config.funnel || funnelFromPath(location.pathname);
  const scope = storageScope(config.apiKey, funnel);

  const engine = new Engine({
    environment: pageEnvironment,
    apiKey: config.apiKey,
    apiBase: config.apiBase,
    send: window.fetch.bind(window),
    campaign,
    storagePrefix: `next:${scope}`,
    storage: { local: browserStorage(() => localStorage), session: browserStorage(() => sessionStorage) },
    cookies: {
      get: cookie,
      set: (name, value, days) => {
        document.cookie = `${name}=${value}; path=/; max-age=${days * 86400}; SameSite=Lax`;
      },
    },
    currency: config.currency,
    params: Object.fromEntries(params),
    visit: {
      landingPage: location.href,
      referrer: document.referrer,
      device: navigator.userAgent,
      deviceType: matchMedia('(pointer: coarse)').matches ? 'mobile' : 'desktop',
      fbp: cookie('_fbp'),
      fbc: cookie('_fbc'),
      domain: location.hostname,
      pixelId: pixelId(),
    },
    funnel: config.funnel || undefined,
    reset: config.reset,
    debug: config.debug,
  });

  if (engine.debug) {
    engine.log.info(`storage scope ${scope} (funnel "${funnel || '(none)'}")`);
    const arrived = { lines: engine.cart.lines(), reset: config.reset };
    void import('./debug').then((m) =>
      m.startDebug(engine, {
        version: __VERSION__,
        apiBase: config.apiBase,
        scope,
        funnel,
        arrived,
        reset: () => location.assign(`${location.pathname}?reset=1`),
        off: () => location.assign(`${location.pathname}?debug=0`),
        analytics: readLegacyAnalytics,
      }),
    );
  }

  if (config.reset) {
    params.delete('reset');
    history.replaceState(history.state, '', `${location.pathname}${params.size ? `?${params}` : ''}${location.hash}`);
  }

  const bindings = bindAll(document, engine);
  const checkoutForm = document.querySelector<HTMLFormElement>('form[data-next-checkout]');
  const checkoutChunk = checkoutForm ? import('./checkout') : undefined;
  if (checkoutForm) {
    for (const href of ['https://payments.29next.com', 'https://core.spreedly.com']) {
      document.head.append(Object.assign(document.createElement('link'), { rel: 'preconnect', href, crossOrigin: '' }));
    }
  }

  const next: NextApi = {
    version: __VERSION__,
    on: (name, fn) => {
      if (RETIRED_EVENTS.some((prefix) => name.startsWith(prefix))) return () => {};
      const legacy = LEGACY_EVENTS[name];
      const event = (name === 'ready' ? 'sdk.ready' : (legacy?.event ?? name)) as EventName | '*';
      if (event !== '*' && !legacy && !EVENT_NAMES.includes(event)) {
        engine.log.warn(`next.on: unknown event "${name}"`);
        return () => {};
      }
      return engine.on(
        event,
        (e) => {
          const data = e.data as Record<string, unknown>;
          if (legacy?.when && !legacy.when(data)) return;
          fn((legacy?.data ? legacy.data(data, engine.getState()) : data) as never, envelope(e, engine) as never);
        },
        { replay: event !== '*' && REPLAYED.includes(event) },
      );
    },
    analytics: {
      on: (name, fn) =>
        engine.on(
          'analytics',
          (e) => {
            if (name === '*' || e.data.name === name) fn(e.data);
          },
          { replay: true },
        ),
    },
    getState: () => engine.getState(),
    context: () => engine.eventContext(),
    log: engine.log,
    bind: (root) => bindings.bind(root),
    actions: {
      addItem: (packageId, quantity) => engine.cart.addItem(packageId, quantity),
      removeItem: (packageId) => engine.cart.removeItem(packageId),
      setQuantity: (packageId, quantity) => engine.cart.setQuantity(packageId, quantity),
      clear: () => engine.cart.clear(),
      applyCoupon: (code) => engine.cart.applyCoupon(code),
      removeCoupon: (code) => engine.cart.removeCoupon(code),
      setShipping: (shippingId) => engine.cart.setShipping(shippingId),
      setGroup: (id, group) =>
        engine.cart.setGroup(id, group && { lines: group.lines, vouchers: group.vouchers ?? [] }),
    },
    ...legacyApi(engine),
  };
  (window as unknown as { next: NextApi }).next = next;

  const orderPage =
    document.querySelector(ORDER_MARKUP) ||
    params.has('ref_id') ||
    params.has('order_ref_id') ||
    params.get('payment_failed') === 'true';
  const orderChunk = orderPage ? import('./order') : undefined;
  if (
    document.querySelector(
      '[data-next-accordion], [data-next-tooltip], [data-next-component="scroll-hint"], [data-next-timer]',
    )
  )
    void import('./bindings/widgets').then((m) =>
      m.bindWidgets(document, { timerStart: (id, ms) => engine.timerStart(id, ms), log: engine.log }),
    );
  const slotsPage = document.querySelector('[data-next-bundle-slot-template-id], [data-next-bundle-slot-template]');
  const slotsChunk = slotsPage ? import('./bindings/slots') : undefined;

  const reveal = () => {
    try {
      bindings.render();
    } finally {
      html.setAttribute('data-next-ready', '');
    }
    announceLegacyReady(next, engine.log);
    const analytics = legacyAnalytics(engine.log);
    if (analytics.enabled) {
      const start = () =>
        import('./analytics').then((m) =>
          m.startAnalytics(engine, {
            apiKey: config.apiKey,
            version: next.version,
            nextCampaign: analytics.nextCampaign,
            dataLayer: analytics.dataLayer,
          }),
        );
      (window.requestIdleCallback ?? setTimeout)(() => void start());
    }
  };
  engine.on('sdk.ready', () => {
    const binding = [
      checkoutForm && checkoutChunk!.then((m) => m.bindCheckout(engine, checkoutForm)),
      orderChunk?.then((m) => m.bindOrder(engine)),
      slotsChunk?.then((m) => m.bindSlots(engine)),
    ].filter(Boolean);
    if (binding.length) void Promise.allSettled(binding).then(reveal);
    else reveal();
  });
  engine.on('sdk.error', (e) => {
    if (e.data.action === 'campaign.load') html.setAttribute('data-next-error', 'campaign');
  });
  void engine.start();

  addEventListener('pageshow', (e) => {
    if (e.persisted) location.reload();
  });
  removeLegacyPersonalData();

  return next;
}
