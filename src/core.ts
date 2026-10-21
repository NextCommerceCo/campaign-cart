import { bindAll } from './bindings';
import type { BootConfig } from './config';
import { Engine } from './engine/engine';
import type { EngineEvent } from './engine/events';
import { funnelFromPath, storageScope } from './engine/scope';
import type { Campaign, EventMap, EventName } from './engine/types';
import {
  announceLegacyReady,
  legacyAnalytics,
  LEGACY_EVENTS,
  legacyApi,
  type LegacyApi,
  removeLegacyPersonalData,
} from './legacy';

declare const __VERSION__: string;

const browserStorage = (get: () => Storage): Storage | null => {
  try {
    return get();
  } catch {
    return null;
  }
};

const cookie = (name: string) => document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`))?.[1];

const EVENT_NAMES: EventName[] = [
  'campaign.loaded',
  'cart.updated',
  'cart.calculated',
  'selection.changed',
  'shipping.changed',
  'storage.degraded',
  'ready',
  'checkout.started',
  'checkout.shipping-added',
  'checkout.payment-added',
  'prospect.saved',
  'order.placed',
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
    applyCoupon(code: string): Promise<void>;
    removeCoupon(code: string): Promise<void>;
    setShipping(shippingId: number | undefined): Promise<void>;
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
    },
    funnel: config.funnel || undefined,
    reset: config.reset,
  });

  if (config.debug) {
    console.info(`[next] storage scope ${scope} (funnel "${funnel || '(none)'}")`);
    engine.on('*', (e) => console.debug('[next]', e.name, e.data), { replay: true });
  }

  if (config.reset) {
    params.delete('reset');
    history.replaceState(history.state, '', `${location.pathname}${params.size ? `?${params}` : ''}${location.hash}`);
  }

  const bindings = bindAll(document, engine);

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
    },
    ...legacyApi(engine),
  };
  (window as unknown as { next: NextApi }).next = next;

  engine.on('ready', () => {
    bindings.render();
    html.setAttribute('data-next-ready', '');
    announceLegacyReady(next);
    const analytics = legacyAnalytics();
    if (analytics.enabled) {
      const start = () =>
        import('./analytics').then((m) =>
          m.startAnalytics(engine, {
            apiKey: config.apiKey,
            version: next.version,
            nextCampaign: analytics.nextCampaign,
          }),
        );
      (window.requestIdleCallback ?? setTimeout)(() => void start());
    }
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
