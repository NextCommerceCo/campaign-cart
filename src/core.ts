import { bindAll } from './bindings';
import type { BootConfig } from './config';
import { Engine } from './engine/engine';
import type { EngineEvent } from './engine/events';
import { funnelFromPath, storageScope } from './engine/scope';
import type { Campaign, CartLine, EventMap, EventName } from './engine/types';
import {
  announceLegacyReady,
  legacyAnalytics,
  LEGACY_EVENTS,
  legacyApi,
  type LegacyApi,
  removeLegacyPersonalData,
} from './legacy';

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
  'campaign.loaded',
  'cart.updated',
  'cart.calculated',
  'coupon.refused',
  'selection.changed',
  'shipping.changed',
  'storage.degraded',
  'ready',
  'checkout.started',
  'checkout.shipping-added',
  'checkout.payment-added',
  'prospect.saved',
  'order.placed',
  'order.loaded',
  'upsell.viewed',
  'upsell.accepted',
  'upsell.skipped',
  'error',
  'exit-intent.shown',
  'exit-intent.clicked',
  'exit-intent.dismissed',
  'exit-intent.closed',
  'exit-intent.action',
];

export interface NextApi extends LegacyApi {
  version: string;
  on<K extends EventName>(name: K | '*', fn: (data: EventMap[K], event: EngineEvent) => void): () => void;
  getState: Engine['getState'];
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

export function boot(config: BootConfig, campaign: Promise<Campaign>): NextApi {
  const html = document.documentElement;
  const params = new URLSearchParams(location.search);
  const funnel = config.funnel || funnelFromPath(location.pathname);
  const scope = storageScope(config.apiKey, funnel);

  const engine = new Engine({
    apiKey: config.apiKey,
    apiBase: config.apiBase,
    send: window.fetch.bind(window),
    campaign,
    storagePrefix: `next:${scope}`,
    storage: { local: browserStorage(() => localStorage), session: browserStorage(() => sessionStorage) },
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
  });

  if (config.debug) {
    console.info(`[next] storage scope ${scope} (funnel "${funnel || '(none)'}")`);
    const reset = () => location.assign(`${location.pathname}?reset=1`);
    void import('./debug').then((m) => m.startDebug(engine, { scope, funnel, reset }));
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
      const event = (LEGACY_EVENTS[name] ?? name) as EventName | '*';
      if (event !== '*' && !EVENT_NAMES.includes(event)) {
        console.warn(`[next] next.on: unknown event "${name}"`);
        return () => {};
      }
      return engine.on(event, (e) => fn(e.data as never, e), { replay: event === 'ready' });
    },
    getState: () => engine.getState(),
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

  const orderPage = document.querySelector(ORDER_MARKUP);
  const orderChunk = orderPage ? import('./order') : undefined;
  if (
    document.querySelector(
      '[data-next-accordion], [data-next-tooltip], [data-next-component="scroll-hint"], [data-next-timer]',
    )
  )
    void import('./widgets').then((m) =>
      m.bindWidgets(document, { timerStart: (id, ms) => engine.timerStart(id, ms) }),
    );
  const slotsPage = document.querySelector('[data-next-bundle-slot-template-id], [data-next-bundle-slot-template]');
  const slotsChunk = slotsPage ? import('./slots') : undefined;

  const reveal = () => {
    try {
      bindings.render();
    } finally {
      html.setAttribute('data-next-ready', '');
    }
    announceLegacyReady(next);
    const analytics = legacyAnalytics();
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
  engine.on('ready', () => {
    const binding = [
      checkoutForm && checkoutChunk!.then((m) => m.bindCheckout(engine, checkoutForm)),
      orderChunk?.then((m) => m.bindOrder(engine)),
      slotsChunk?.then((m) => m.bindSlots(engine)),
    ].filter(Boolean);
    if (binding.length) void Promise.allSettled(binding).then(reveal);
    else reveal();
  });
  engine.on('error', (e) => {
    if (e.data.action === 'load') html.setAttribute('data-next-error', 'campaign');
  });
  void engine.start();

  addEventListener('pageshow', (e) => {
    if (e.persisted) location.reload();
  });
  removeLegacyPersonalData();

  return next;
}
