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

export function parseForcePackages(raw: string | null): Array<{ packageId: number; quantity: number }> {
  if (!raw) return [];
  return raw
    .split(',')
    .map((part) => part.split(':').map(Number))
    .filter(([id]) => id && id > 0)
    .map(([id, qty]) => ({ packageId: id!, quantity: qty && qty > 0 ? qty : 1 }));
}

const EVENT_NAMES: EventName[] = [
  'campaign.loaded',
  'cart.updated',
  'cart.calculated',
  'selection.changed',
  'shipping.changed',
  'storage.degraded',
  'ready',
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
  });

  if (config.debug) {
    console.info(`[next] storage scope ${scope} (funnel "${funnel || '(none)'}")`);
    engine.on('*', (e) => console.debug('[next]', e.name, e.data), { replay: true });
  }

  if (config.reset) {
    engine.reset();
    params.delete('reset');
    history.replaceState(history.state, '', `${location.pathname}${params.size ? `?${params}` : ''}${location.hash}`);
  }

  const hasSnapshot = engine.restore();

  const forced = parseForcePackages(params.get('forcePackageId'));
  if (forced.length) {
    void engine.clear();
    void engine.setGroup('items', { lines: forced, vouchers: [] });
  }

  const bindings = bindAll(document, engine);

  let ready = false;
  const next: NextApi = {
    version: __VERSION__,
    on: (name, fn) => {
      const event = (LEGACY_EVENTS[name] ?? name) as EventName | '*';
      if (event !== '*' && !EVENT_NAMES.includes(event)) {
        console.warn(`[next] next.on: unknown event "${name}"`);
        return () => {};
      }
      return engine.on(event, (e) => fn(e.data as never, e), { replay: event === 'ready' && ready });
    },
    getState: () => engine.getState(),
    bind: (root) => bindings.bind(root),
    actions: {
      addItem: (packageId, quantity) => engine.addItem(packageId, quantity),
      removeItem: (packageId) => engine.removeItem(packageId),
      setQuantity: (packageId, quantity) => engine.setQuantity(packageId, quantity),
      clear: () => engine.clear(),
      applyCoupon: (code) => engine.applyCoupon(code),
      removeCoupon: (code) => engine.removeCoupon(code),
      setShipping: (shippingId) => engine.setShipping(shippingId),
    },
    ...legacyApi(engine),
  };
  (window as unknown as { next: NextApi }).next = next;

  const markReady = () => {
    if (ready) return;
    ready = true;
    bindings.render();
    html.setAttribute('data-next-ready', '');
    engine.events.emit('ready', { lines: engine.lines() });
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
  };

  engine.on('error', (e) => {
    if (e.data.action === 'load') html.setAttribute('data-next-error', 'campaign');
  });
  const loading = engine.load();
  if (hasSnapshot) markReady();
  void loading.then(() => {
    if (engine.getState().campaign) markReady();
  });

  addEventListener('pageshow', (e) => {
    if (e.persisted) location.reload();
  });
  removeLegacyPersonalData();

  return next;
}
