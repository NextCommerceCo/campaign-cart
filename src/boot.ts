import { bindAll } from './bindings';
import { pageEnvironment } from './bindings/environment';
import { runReadyQueue } from './bindings/ready';
import type { BootConfig } from './config';
import { Engine } from './engine/engine';
import { envelope, PUBLIC, type SdkEvent } from './engine/events/bus';
import type { Logger } from './engine/log';
import { funnelFromPath, storageScope } from './engine/scope';
import type { TrackingEvent, TrackingName } from './engine/events/analytics';
import type { EventMap, EventName, InternalEventName } from './engine/events/bus';
import type { EventContext } from './engine/events/context';
import type { Snapshot } from './engine/events/sdk';
import type { Campaign } from './engine/types';
import type { ActionArgs, ActionName, ActionResult, Actions, NextActions } from './engine/actions';
import { Query, type ModelType } from './engine/query';
import { announceLegacyReady, legacyApi, type LegacyApi } from './compat/legacy/api';
import { legacyEvents } from './compat/legacy/registry';
import { legacyAnalytics, readLegacyAnalytics, removeLegacyPersonalData } from './compat/legacy/globals';

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
  /** Reads a path of the object model, as `data-next-query` does: `next.query('cart.total')`. */
  query(path: string): unknown;
  /** Calls `fn` with the path's value now and each time it changes; returns an unsubscribe function. */
  watch(path: string, fn: (value: unknown) => void): () => void;
  /** Adds a field the page computes to every object of a type, read like the SDK's own: `next.define('Option', 'per_day', (o) => o.total / 30, { format: 'currency' })`. */
  define(type: ModelType, name: string, derive: (object: any) => unknown, options?: { format?: string }): void;
  /** Every action `data-next-action` names, taking one object of the model's field names and resolving to `{ ok, errors }`. */
  actions: NextActions;
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

  const paymentFailed = params.get('payment_failed') === 'true';
  if (config.reset || paymentFailed) {
    for (const name of ['reset', 'payment_failed', 'payment_method']) params.delete(name);
    history.replaceState(history.state, '', `${location.pathname}${params.size ? `?${params}` : ''}${location.hash}`);
  }

  const legacy = legacyEvents(engine);
  const bindings = bindAll(document, engine);
  const checkoutForm = document.querySelector<HTMLFormElement>('form[data-next-checkout]');
  const checkoutChunk = checkoutForm ? import('./checkout') : undefined;
  if (checkoutForm) {
    for (const href of ['https://payments.29next.com', 'https://core.spreedly.com']) {
      document.head.append(Object.assign(document.createElement('link'), { rel: 'preconnect', href, crossOrigin: '' }));
    }
  }

  const query = new Query(engine);
  let attributes: Promise<typeof import('./attributes')> | undefined;
  let made: Actions | undefined;
  const action =
    (name: ActionName) =>
    (args?: ActionArgs): Promise<ActionResult> =>
      (attributes ??= import('./attributes')).then((m) => (made ??= m.pageActions(engine))[name](args));
  const actions = Object.fromEntries(
    (
      [
        'addItem',
        'removeItem',
        'setQuantity',
        'select',
        'clear',
        'applyCoupon',
        'removeCoupon',
        'setShipping',
        'acceptUpsell',
        'skipUpsell',
        'go',
      ] as const
    ).map((n) => [n, action(n)]),
  ) as Actions;
  const positional = <A extends unknown[], R>(legacy: (...a: A) => R, current: (args: ActionArgs) => unknown) =>
    ((...a: A) => (typeof a[0] === 'object' && a[0] !== null ? current(a[0] as ActionArgs) : legacy(...a))) as never;

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
    bind: (root) => bindings.bind(root),
    query: (path) => query.get(path),
    watch: (path, fn) => query.watch(path, fn),
    define: (type, name, derive, options) => query.define(type, name, derive, options),
    actions: {
      ...actions,
      addItem: positional(
        (packageId: number, quantity?: number) => engine.cart.addItem(packageId, quantity),
        actions.addItem,
      ),
      removeItem: positional((packageId: number) => engine.cart.removeItem(packageId), actions.removeItem),
      setQuantity: positional(
        (packageId: number, quantity: number) => engine.cart.setQuantity(packageId, quantity),
        actions.setQuantity,
      ),
      applyCoupon: positional((code: string) => engine.cart.applyCoupon(code), actions.applyCoupon),
      removeCoupon: positional((code: string) => engine.cart.removeCoupon(code), actions.removeCoupon),
      setShipping: positional(
        (shippingId: number | undefined) => engine.cart.setShipping(shippingId),
        actions.setShipping,
      ),
      setGroup: (id, group) =>
        engine.cart.setGroup(id, group && { lines: group.lines, vouchers: group.vouchers ?? [] }),
    },
    ...legacyApi(engine),
  };
  (window as unknown as { next: NextApi }).next = next;

  const orderPage =
    document.querySelector(ORDER_MARKUP) || params.has('ref_id') || params.has('order_ref_id') || paymentFailed;
  const orderChunk = orderPage ? import('./order') : undefined;
  const widgetsPage = document.querySelector(
    '[data-next-accordion], [data-next-tooltip], [data-next-component="scroll-hint"], [data-next-timer]',
  );
  if (widgetsPage)
    void import('./compat/widgets').then((m) =>
      m.bindWidgets(document, {
        timerStart: (id, ms) => engine.visit.timerStart(id, ms),
        log: engine.log,
        events: legacy.widgets,
      }),
    );
  const slotsPage = document.querySelector('[data-next-bundle-slot-template-id], [data-next-bundle-slot-template]');
  const slotsChunk = slotsPage ? import('./bindings/slots') : undefined;

  const reveal = () => {
    try {
      bindings.render();
    } finally {
      html.setAttribute('data-next-ready', '');
    }
    announceLegacyReady(next);
    runReadyQueue(next, engine.log);
    const analytics = legacyAnalytics(engine.log);
    if (analytics.enabled) {
      const start = () =>
        import('./analytics').then((m) =>
          m.startAnalytics(engine, {
            apiKey: config.apiKey,
            version: next.version,
            nextCampaign: analytics.nextCampaign,
            legacy: analytics,
          }),
        );
      (window.requestIdleCallback ?? setTimeout)(() => void start());
    }
  };
  engine.on('sdk.ready', () => {
    const binding = [
      checkoutForm &&
        checkoutChunk!.then((m) =>
          m.bindCheckout(engine, checkoutForm, { legacyCheckoutStarted: legacy.checkoutStarted }),
        ),
      orderChunk?.then((m) => m.bindOrder(engine)),
      slotsChunk?.then((m) => m.bindSlots(engine)),
      bindings.ready,
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
