import { Api, failureOf } from './api';
import { type Attribution, buildAttribution, eventAttribution, type Visit } from './attribution';
import { type CartActions, createCart, emptyCart } from './cart/cart';
import type { CheckoutActions } from '../checkout/state/checkout';
import type { OrderActions } from '../order/state';
import {
  type Browser,
  type EngineEvent,
  type ErrorAction,
  type EventCampaign,
  type EventContext,
  Events,
  type Snapshot,
} from './events';
import { type LogLevel, Logger } from './log';
import { appliedCodes, publicOrder } from './order';
import { keptParams, parseForcePackages } from './params';
import { createSelectors, type SelectorActions } from './cart/selectors';
import { campaignSession, type Cookies } from './session';
import { StorageAdapter } from './storage';
import { createToggles, type ToggleActions } from './cart/toggles';
import type { EventMap, EventName } from './events';
import type { Campaign, Package, Send, State } from './types';

/** The page and the browser now; supplied by the page, since the engine has no DOM. */
export interface Environment {
  page_location: string;
  page_referrer: string;
  browser: Browser;
}

export interface EngineOptions {
  environment: () => Environment;
  apiKey: string;
  apiBase: string;
  send: Send;
  campaign: Promise<Campaign>;
  storagePrefix: string;
  storage: { local: Storage | null; session: Storage | null };
  currency?: string;
  params?: Record<string, string>;
  visit?: Visit;
  funnel?: string;
  reset?: boolean;
  now?: () => number;
  logLevel?: LogLevel;
  debug?: boolean;
  cookies?: Cookies;
}

export interface Context {
  getState(): State;
  update<K extends keyof State>(slice: K, patch: Partial<NonNullable<State[K]>>, options?: { silent?: boolean }): void;
  emit<K extends EventName>(name: K, data: EventMap[K]): void;
  on<K extends EventName>(name: K, fn: (event: EngineEvent<K>) => void, options?: { replay?: boolean }): () => void;
  fail(action: ErrorAction, err: unknown): void;
  log: Logger;
  getPackage(id: number): Package | undefined;
  attribution(): Attribution;
  saved<T>(slice: keyof State): T | undefined;
  forget(slice: 'checkout'): void;
  local: StorageAdapter;
  api: Api;
}

const SNAPSHOT_MAX_AGE = 10 * 60 * 1000;

export class Engine {
  readonly log: Logger;
  readonly events: Events;
  readonly cart: CartActions;
  readonly selectors: SelectorActions;
  readonly toggles: ToggleActions;
  readonly debug: boolean;
  readonly sessionId: () => string;
  checkout?: CheckoutActions;
  order?: OrderActions;
  private state: State;
  private api: Api;
  private session: StorageAdapter;
  private local: StorageAdapter;
  private debugStore: StorageAdapter;
  private listeners = new Set<() => void>();
  private notifying = false;
  private ready = false;
  private context: Context;

  constructor(private options: EngineOptions) {
    this.log = new Logger(options.logLevel, options.now);
    this.events = new Events(this.log);
    this.sessionId = campaignSession(options.cookies, options.storage.local);
    this.api = new Api(options.apiKey, options.send, options.apiBase, this.log, this.sessionId);
    const adapter = (name: string, backends: Array<Storage | null>) =>
      new StorageAdapter({
        prefix: options.storagePrefix,
        version: 1,
        backends,
        now: options.now,
        onDegrade: (reason) =>
          this.events.emit('sdk.error', {
            action: 'storage.write',
            code: 'unavailable',
            message: `${name}: ${reason}`,
          }),
      });
    this.session = adapter('session', [options.storage.session]);
    this.local = adapter('local', [options.storage.local, options.storage.session]);
    this.debugStore = new StorageAdapter({ prefix: 'next', version: 1, backends: [options.storage.session] });
    if (options.debug) this.debugStore.set('debugging', true);
    if (options.debug === false) for (const name of ['debugging', 'debug']) this.debugStore.remove(name);
    this.debug = this.debugStore.get<boolean>('debugging') === true;
    if (this.debug) this.log.level = 'debug';
    this.state = {
      cart: emptyCart(),
      selectors: {},
      toggles: {},
      visit: { params: options.params ?? {}, landing: options.visit, exitIntentShown: 0, timers: {} },
    };
    this.context = {
      getState: () => this.state,
      update: (slice, patch, opts) => this.update(slice, patch, opts),
      emit: (name, data) => this.events.emit(name, data),
      on: (name, fn, options) => this.events.on(name, fn, options),
      fail: (action, err) => this.fail(action, err),
      log: this.log,
      getPackage: (id) => this.getPackage(id),
      attribution: () => this.attribution(),
      saved: (slice) => (slice === 'debug' ? this.debugStore : this.session).get(slice),
      forget: (slice) => {
        this.session.remove(slice);
        this.state = { ...this.state, [slice]: undefined };
      },
      local: this.local,
      api: this.api,
    };
    this.cart = createCart(this.context);
    this.selectors = createSelectors(this.context, this.cart);
    this.toggles = createToggles(this.context);

    if (options.reset) {
      this.session.clear();
      this.local.clear();
    }
    this.restore();
    const forced = parseForcePackages(options.params?.forcePackageId);
    if (forced.length) {
      void this.cart.clear();
      void this.cart.setGroup('items', { lines: forced, vouchers: [] });
    }
  }

  async start(): Promise<void> {
    this.markReady();
    await this.load();
    this.markReady();
  }

  attach<T>(create: (ctx: Context) => T): T {
    return create(this.context);
  }

  getState(): Readonly<State> {
    return this.state;
  }

  subscribe(fn: () => void): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  on<K extends EventName>(name: K | '*', fn: (event: EngineEvent<K>) => void, options?: { replay?: boolean }) {
    return this.events.on(name, fn, options);
  }

  getPackage(id: number): Package | undefined {
    return this.state.campaign?.packages.find((p) => p.ref_id === id);
  }

  eventCampaign(): EventCampaign | undefined {
    const c = this.state.campaign;
    return c && { id: c.id, name: c.name, currency: c.currency, language: c.language };
  }

  snapshot(): Snapshot {
    const { checkout, order } = this.state;
    const campaign = this.eventCampaign();
    const placed = order?.order;
    return {
      ...(campaign && { campaign }),
      cart: this.cart.current(),
      ...(checkout && { checkout: this.cart.currentCheckout() }),
      ...(placed && { order: publicOrder(placed, appliedCodes(placed, order.coupon)) }),
      selectors: this.selectors.list(),
    };
  }

  eventContext(): EventContext {
    const { browser, ...page } = this.options.environment();
    const campaign = this.eventCampaign();
    return {
      ...page,
      ...(campaign && { campaign }),
      session_id: this.sessionId(),
      attribution: eventAttribution(this.attribution()),
      browser,
    };
  }

  attribution(): Attribution {
    const { visit, campaign } = this.state;
    return buildAttribution(
      visit.params,
      visit.landing,
      this.options.funnel || campaign?.name,
      (this.options.now ?? Date.now)(),
    );
  }

  noteExitIntentShown(): void {
    this.update('visit', { exitIntentShown: this.state.visit.exitIntentShown + 1 });
  }

  timerStart(id: string, durationMs: number): number {
    const now = (this.options.now ?? Date.now)();
    const { [id]: start, ...others } = this.state.visit.timers;
    if (start === undefined) this.update('visit', { timers: { ...others, [id]: now } });
    else if (start + durationMs <= now) this.update('visit', { timers: others });
    return start ?? now;
  }

  private restore(): void {
    const cart = this.session.get<Partial<State['cart']>>('cart');
    const visit = this.session.get<Partial<State['visit']>>('visit');
    const campaign = this.local.get<Campaign>(this.campaignKey(), SNAPSHOT_MAX_AGE);
    this.state = { ...this.state, cart: { ...this.state.cart, ...cart }, ...(campaign && { campaign }) };
    this.update('visit', {
      params: { ...visit?.params, ...this.state.visit.params },
      landing: visit?.landing ?? this.state.visit.landing,
      exitIntentShown: visit?.exitIntentShown ?? 0,
      timers: visit?.timers ?? {},
    });
    if (campaign) this.events.emit('campaign.loaded', { campaign, fromCache: true });
  }

  private async load(): Promise<void> {
    let campaign: Campaign;
    try {
      campaign = await this.options.campaign;
    } catch (err) {
      this.fail('campaign.load', err);
      if (this.state.campaign) this.price();
      return;
    }
    this.update('campaign', campaign);
    this.events.emit('campaign.loaded', { campaign, fromCache: false });
    this.price();
  }

  private price(): void {
    void this.cart.campaignLoaded();
    this.selectors.campaignLoaded();
  }

  private markReady(): void {
    if (this.ready || !this.state.campaign) return;
    this.ready = true;
    this.events.emit('sdk.ready', this.snapshot());
  }

  private update<K extends keyof State>(
    slice: K,
    patch: Partial<NonNullable<State[K]>>,
    { silent = false }: { silent?: boolean } = {},
  ): void {
    this.state = { ...this.state, [slice]: { ...this.state[slice], ...patch } };
    this.save(slice);
    if (silent || this.notifying) return;
    this.notifying = true;
    queueMicrotask(() => {
      this.notifying = false;
      this.listeners.forEach((fn) => fn());
    });
  }

  private save(slice: keyof State): void {
    const { cart, visit, campaign, checkout, order, debug } = this.state;
    if (slice === 'cart') {
      const { groups, coupons, held, dismissed, shippingId, reported, added } = cart;
      this.session.set('cart', { groups, coupons, held, dismissed, shippingId, reported, added });
    }
    if (slice === 'visit') this.session.set('visit', { ...visit, params: keptParams(visit.params) });
    if (slice === 'campaign') this.local.set(this.campaignKey(), campaign);
    if (slice === 'debug' && debug) this.debugStore.set('debug', debug);
    if (slice === 'order' && order) {
      const { refId, order: saved, loadedAt, accepted, coupon } = order;
      this.session.set('order', { refId, order: saved, loadedAt, accepted, coupon });
    }
    if (slice === 'checkout' && checkout) {
      const {
        fields,
        phones,
        sameAsShipping,
        paymentMethod,
        step,
        prospectSaved,
        pendingRef,
        pendingMethod,
        id,
        reported,
      } = checkout;
      const { user, shippingAddress, billingAddress } = checkout;
      this.session.set('checkout', {
        fields,
        phones,
        sameAsShipping,
        paymentMethod,
        step,
        prospectSaved,
        user,
        shippingAddress,
        billingAddress,
        pendingRef,
        pendingMethod,
        id,
        reported,
      });
    }
  }

  private campaignKey(): string {
    return `campaign:${this.options.currency ?? 'default'}`;
  }

  private fail(action: ErrorAction, err: unknown): void {
    const failure = failureOf(err);
    this.log.info(`${action} failed (${failure.code}): ${failure.message}`);
    this.events.emit('sdk.error', { action, ...failure });
  }
}
