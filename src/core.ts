import { bindAll } from './bindings';
import type { BootConfig } from './config';
import { Engine, ENGINE_STORAGE_VERSION } from './engine/engine';
import type { EngineEvent } from './engine/events';
import { funnelFromPath, storageScope } from './engine/scope';
import { StorageAdapter } from './engine/storage';
import type { Campaign, EventName } from './engine/types';
import { announceLegacyReady, legacyApi, type LegacyApi } from './legacy';

function browserStorage(get: () => Storage): Storage | null {
  try {
    return get();
  } catch {
    return null;
  }
}

export function parseForcePackages(raw: string | null): Array<{ packageId: number; quantity: number }> {
  if (!raw) return [];
  return raw
    .split(',')
    .map((part) => part.split(':').map(Number))
    .filter(([id]) => id && id > 0)
    .map(([id, qty]) => ({ packageId: id!, quantity: qty && qty > 0 ? qty : 1 }));
}

export interface NextApi extends LegacyApi {
  version: string;
  on(name: EventName | '*', fn: (event: EngineEvent) => void, options?: { replay?: boolean }): () => void;
  getState: Engine['getState'];
  bind(root: ParentNode): void;
  actions: Pick<
    Engine,
    'addItem' | 'removeItem' | 'setQuantity' | 'setGroup' | 'clear' | 'applyCoupon' | 'removeCoupon' | 'setShipping'
  >;
}

declare const __VERSION__: string;

export function boot(config: BootConfig, prefetched?: Promise<Campaign>): { engine: Engine; next: NextApi } {
  const html = document.documentElement;
  const funnel = config.funnel || funnelFromPath(location.pathname);
  const scope = storageScope(config.apiKey, funnel);

  let engine!: Engine;
  const storage = new StorageAdapter({
    prefix: `next:${scope}`,
    version: ENGINE_STORAGE_VERSION,
    local: browserStorage(() => localStorage),
    session: browserStorage(() => sessionStorage),
    onDegrade: (tier, reason) => engine?.events.emit('storage.degraded', { tier, reason }),
  });
  if (config.reset) storage.clear();

  const params = Object.fromEntries(new URLSearchParams(location.search));
  engine = new Engine({
    apiKey: config.apiKey,
    apiBase: config.apiBase,
    storage,
    fetch: window.fetch.bind(window),
    currency: config.currency,
    params,
    prefetchedCampaign: prefetched,
  });

  console.info(`[next] storage scope ${scope} (funnel "${funnel || '(none)'}")`);

  const hasSnapshot = engine.restore();

  const forced = parseForcePackages(params.forcePackageId ?? null);
  if (forced.length) {
    void engine.clear();
    void engine.setGroup('items', { lines: forced, vouchers: [] });
  }

  const bindings = bindAll(document, engine);

  const next: NextApi = {
    version: typeof __VERSION__ === 'string' ? __VERSION__ : 'dev',
    on: (name, fn, options) => engine.on(name, fn, options),
    getState: () => engine.getState(),
    bind: (root) => bindings.bind(root),
    actions: engine,
    ...legacyApi(engine),
  };

  let ready = false;
  const markReady = () => {
    if (ready) return;
    ready = true;
    bindings.render();
    html.setAttribute('data-next-ready', '');
    engine.events.emit('ready', {});
    announceLegacyReady(next, next.version);
  };

  (window as unknown as { next: NextApi }).next = next;

  if (hasSnapshot) markReady();
  void engine.load().then(() => {
    if (engine.getState().campaign) markReady();
    else if (!hasSnapshot) html.setAttribute('data-next-error', 'campaign');
  });

  if (config.debug) {
    engine.on('*', (e) => console.debug('[next]', e.name, e.data), { replay: true });
  }

  return { engine, next };
}
