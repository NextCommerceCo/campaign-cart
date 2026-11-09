import { bindAll, type Bindings } from './bindings';
import { browserOptions, browserStorage } from './dom/browser';
import { pageEnvironment } from './dom/environment';
import { runReadyQueue } from './dom/ready';
import type { BootConfig } from './config';
import { Engine } from './engine/engine';
import { envelope, PUBLIC, type SdkEvent } from './engine/events/bus';
import type { Logger } from './engine/runtime/log';
import { funnelFromPath, storageScope } from './engine/visit/scope';
import type { TrackingEvent, TrackingName } from './engine/events/analytics';
import type { EventMap, EventName, InternalEventName } from './engine/events/bus';
import type { EventContext } from './engine/events/context';
import type { Snapshot } from './engine/events/sdk';
import type { Campaign, Send } from './engine/types';
import type { NextActions } from './engine/actions';
import type { ModelType, Query } from './engine/display/query';
import { announceLegacyReady, legacyApi, type LegacyApi } from './compat/legacy/api';
import { legacyEvents, type LegacyEvents } from './compat/legacy/registry';
import {
  legacyAnalytics,
  nextConfig,
  readLegacyAnalytics,
  readLegacyI18n,
  removeLegacyPersonalData,
} from './compat/legacy/globals';
import { triedConfig, withTried } from './engine/visit/debug-config';
import { localeOf } from './engine/display/format';
import { trackingIgnored } from './engine/visit/params';
import { rulesSend, textsIn, type Texts } from './engine/display/texts';

declare const __VERSION__: string;

const ORDER_MARKUP =
  '[data-next-upsell], [data-next-order-items], [data-next-display^="order."], [data-next-show^="order."], [data-next-hide^="order."]';
/** 0.4.x and 0.5 markup the checkout and order chunks bind, beside what `bindAll` binds. */
const LEGACY_FORMS =
  '[data-next-checkout-field], [os-checkout-field], [data-next-upsell], [data-next-upsell-action], [data-next-order-items]';
const V2 =
  '[data-next-query],[data-next-each],[data-next-for],[data-next-selector],[data-next-option],[data-next-field],[data-next-action]:not([data-next-action=add-to-cart],[data-next-action=select-variants],[data-next-action=checkout])';

const v2In = (root: ParentNode) => !!root.querySelector(V2) || (root instanceof Element && root.matches(V2));

/** The names `next.on` takes: every event but the SDK's internal ones. */
export type PublicEventName = Exclude<EventName, InternalEventName>;

export interface NextApi extends LegacyApi {
  version: string;
  /**
   * Calls `fn` with every `name` event, or every event for `*`, starting with the ones this page
   * sent before the call. A 0.4.x name gets its 0.4.x payload, and only the events after the call
   * unless 0.4.x pages listen for it late (`campaign:loaded`, `checkout:started`, …).
   */
  on<K extends PublicEventName>(
    name: K | 'ready' | '*',
    fn: (data: EventMap[K], event: SdkEvent<K>) => void,
  ): () => void;
  analytics: {
    /** Calls `fn` with every `name` tracking event, or every one for `*`, starting with the ones this page already sent. */
    on(name: TrackingName | '*', fn: (event: TrackingEvent) => void): () => void;
  };
  /** What the page shows now: the campaign, cart, checkout, order and selectors, as the events carry them. */
  snapshot(): Snapshot;
  /** The SDK's internal state, for debugging; its shape changes between releases. Read `snapshot()` instead. */
  getState: Engine['getState'];
  /** The page, campaign, session, attribution and browser now, as on tracking events. */
  context(): EventContext;
  log: Pick<Logger, 'level' | 'entries' | 'stream'>;
  bind(root: ParentNode): void;
  /** Reads a path of the object model, as `data-next-query` does: `await next.query('cart.total')`. Its code loads on the first call. */
  query(path: string): Promise<unknown>;
  /** Calls `fn` with the path's value once its code has loaded, then each time it changes; returns an unsubscribe function. */
  watch(path: string, fn: (value: unknown) => void): () => void;
  /** Adds a field the page computes to every object of a type, read like the SDK's own: `next.define('Option', 'per_day', (o) => o.total / 30, { format: 'currency' })`. */
  define(type: ModelType, name: string, derive: (object: any) => unknown, options?: { format?: string }): void;
  /** Every action `data-next-action` names, taking one object of the model's field names and resolving to `{ ok, errors }`. */
  actions: NextActions;
}

/** @internal */
export function boot(config: BootConfig, campaign: Promise<Campaign>): NextApi {
  const params = new URLSearchParams(location.search);
  const funnel = config.funnel || funnelFromPath(location.pathname);
  const scope = storageScope(config.apiKey, funnel);
  const page = nextConfig();
  const tried = triedConfig(
    browserStorage(() => sessionStorage),
    config.debug,
  );
  if (tried) Object.assign(window, { nextConfig: withTried(page, tried) });
  const i18n = readLegacyI18n();
  const send = window.fetch.bind(window);
  const rules = rulesSend(send, config.apiKey);

  const engine = new Engine({
    environment: pageEnvironment,
    apiKey: config.apiKey,
    apiBase: config.apiBase,
    send,
    campaign,
    storagePrefix: `next:${scope}`,
    ...browserOptions(),
    currency: config.currency,
    locale: config.lang || i18n.locale,
    params: Object.fromEntries(params),
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
        send: rules,
        page,
        tried: !!tried,
        analytics: () => ({ ...readLegacyAnalytics(), ignored: trackingIgnored(engine.getState().visit.params) }),
      }),
    );
  }

  const paymentFailed = params.get('payment_failed') === 'true';
  if (config.reset || paymentFailed) {
    for (const name of ['reset', 'payment_failed', 'payment_method']) params.delete(name);
    history.replaceState(history.state, '', `${location.pathname}${params.size ? `?${params}` : ''}${location.hash}`);
  }

  const legacy = legacyEvents(engine, () => import('./compat/legacy'));
  const bindings = bindAll(document, engine);
  if (bindings.legacy || !v2In(document) || document.querySelector(LEGACY_FORMS)) void legacy.preload();
  const [next, queried, bindV2] = nextApi(engine, legacy, bindings);
  (window as unknown as { next: NextApi }).next = next;
  const orderParams = params.has('ref_id') || params.has('order_ref_id') || paymentFailed;
  const bindChunks = pageChunks(engine, legacy, queried, orderParams, rules, i18n.translations);
  revealWhenBound(engine, bindings, next, bindChunks, bindV2, config.apiKey);
  engine.on('sdk.error', (e) => {
    if (e.data.action === 'campaign.load') document.documentElement.setAttribute('data-next-error', 'campaign');
  });
  void engine.start();

  addEventListener('pageshow', (e) => {
    if (e.persisted) location.reload();
  });
  removeLegacyPersonalData();

  return next;
}

/** Loads the lazy chunks the page's markup needs; the function it returns binds them once the campaign has loaded. */
function pageChunks(
  engine: Engine,
  legacy: LegacyEvents,
  queried: () => Promise<Query>,
  orderParams: boolean,
  rules: Send,
  translations: Record<string, Texts>,
): (v2Page: boolean) => unknown[] {
  const form = document.querySelector<HTMLFormElement>('form[data-next-checkout]');
  const checkout = form ? import('./checkout') : undefined;
  if (form) {
    for (const href of ['https://payments.29next.com', 'https://core.spreedly.com']) {
      document.head.append(Object.assign(document.createElement('link'), { rel: 'preconnect', href, crossOrigin: '' }));
    }
  }
  const order = document.querySelector(ORDER_MARKUP) || orderParams ? import('./order') : undefined;
  const widgets = document.querySelector(
    '[data-next-accordion], [data-next-tooltip], [data-next-component="scroll-hint"], [data-next-timer]',
  );
  if (widgets)
    void import('./compat/widgets').then((m) =>
      m.bindWidgets(document, {
        timerStart: (id, ms) => engine.visit.timerStart(id, ms),
        log: engine.log,
        events: legacy.widgets,
      }),
    );
  const i18n = document.querySelector('[data-next-i18n]') ? import('./compat/i18n') : undefined;
  const slots = document.querySelector('[data-next-bundle-slot-template-id], [data-next-bundle-slot-template]')
    ? import('./bindings/slots')
    : undefined;
  return (v2Page) => [
    form &&
      Promise.all([checkout!, v2Page && queried()]).then(([m, q]) =>
        m.bindCheckout(engine, form, {
          rules,
          legacyCheckoutStarted: legacy.checkoutStarted,
          query: q || undefined,
          translations,
        }),
      ),
    order?.then((m) => m.bindOrder(engine)),
    slots?.then((m) => m.bindSlots(engine)),
    i18n?.then((m) => {
      const lang = localeOf(engine.getState()) || 'en';
      void m.bindI18n(document, { send: rules, lang, page: textsIn(translations, lang), log: engine.log });
    }),
  ];
}

/** `window.next`, with the query and attributes v2 loaders it shares with the page's own binding. */
function nextApi(
  engine: Engine,
  legacy: LegacyEvents,
  bindings: Bindings,
): [NextApi, () => Promise<Query>, () => Promise<{ bind(root: ParentNode): void }>] {
  let query: Promise<Query> | undefined;
  const queried = () => (query ??= import('./engine/display/query').then((m) => new m.Query(engine)));
  let attributes: Promise<typeof import('./attributes')> | undefined;
  /** Every `next.actions` call loads the actions on first use; 0.5's positional calls work there too. */
  const actions = new Proxy({} as NextActions, {
    get:
      (_, name: string) =>
      (...args: unknown[]) =>
        (attributes ??= import('./attributes')).then((m) => m.runAction(engine, name, args)),
  });
  let v2: Promise<{ bind(root: ParentNode): void }> | undefined;
  const bindV2 = () =>
    (v2 ??= Promise.all([(attributes ??= import('./attributes')), queried()]).then(([m, q]) =>
      m.bindAttributes(document, engine, q, { deferred: bindings.deferred }),
    ));
  const next: NextApi = {
    version: __VERSION__,
    on: (name, fn) => {
      const legacyOff = legacy.on(name, (data, e) =>
        fn(data as never, (e && envelope(e, engine.sessionId())) as never),
      );
      if (legacyOff) return legacyOff;
      const event = (name === 'ready' ? 'sdk.ready' : name) as EventName | '*';
      if (event !== '*' && !PUBLIC.has(event)) {
        engine.log.warn(`next.on: unknown event "${name}"`);
        return () => {};
      }
      return engine.on(
        event,
        (e) => {
          if (event === '*' && !PUBLIC.has(e.name)) return;
          fn(e.data as never, envelope(e, engine.sessionId()) as never);
        },
        { replay: true },
      );
    },
    analytics: {
      on: (name, fn) =>
        engine.on(
          'analytics',
          (e) => {
            if (name === '*' || e.data.event_type === name) fn(e.data);
          },
          { replay: true },
        ),
    },
    snapshot: () => engine.snapshot(),
    getState: () => engine.getState(),
    context: () => engine.eventContext(),
    log: engine.log,
    bind: (root) => {
      bindings.bind(root);
      if (v2 || v2In(root)) void bindV2().then((b) => b.bind(root));
    },
    query: (path) => queried().then((q) => q.get(path)),
    watch: (path, fn) => {
      const off = queried().then((q) => q.watch(path, fn));
      return () => void off.then((stop) => stop());
    },
    define: (...args) => void queried().then((q) => q.define(...args)),
    actions,
    ...legacyApi(engine),
  };
  return [next, queried, bindV2];
}

/**
 * Once the campaign has loaded and the page's chunks are bound, shows the page, runs its ready callbacks and
 * starts analytics when the browser is idle.
 */
function revealWhenBound(
  engine: Engine,
  bindings: Bindings,
  next: NextApi,
  bindChunks: (v2Page: boolean) => unknown[],
  bindV2: () => Promise<unknown>,
  apiKey: string,
) {
  const reveal = () => {
    try {
      bindings.render();
    } finally {
      document.documentElement.setAttribute('data-next-ready', '');
      performance.mark?.('next:ready');
    }
    announceLegacyReady(next);
    runReadyQueue(next, engine.log);
    const analytics = legacyAnalytics(engine.log);
    const ignored = trackingIgnored(engine.getState().visit.params);
    if (ignored) engine.log.info('analytics off for this tab: ?ignore=true (?ignore=false turns it back on)');
    if (analytics.enabled && !ignored) {
      const start = () =>
        import('./analytics').then((m) =>
          m.startAnalytics(engine, {
            apiKey,
            version: next.version,
            nextCampaign: analytics.nextCampaign,
            legacy: analytics,
          }),
        );
      (window.requestIdleCallback ?? setTimeout)(() => void start());
    }
  };
  engine.on('sdk.ready', () => {
    const v2Page = v2In(document) || bindings.deferred.size > 0;
    const binding = [...bindChunks(v2Page), v2Page && bindV2(), bindings.ready].filter(Boolean);
    if (binding.length) void Promise.allSettled(binding).then(reveal);
    else reveal();
  });
}
