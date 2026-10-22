import { Api } from './api';
import { type Attribution, buildAttribution, type Visit } from './attribution';
import { type CartActions, createCart, emptyCart } from './cart';
import type { CheckoutActions } from './checkout';
import type { OrderActions } from './order';
import { type EngineEvent, Events } from './events';
import { keptParams, parseForcePackages } from './params';
import { createSelectors, type SelectorActions } from './selectors';
import { StorageAdapter } from './storage';
import { createToggles, type ToggleActions } from './toggles';
import type { Campaign, EventMap, EventName, Package, Send, State } from './types';

export interface EngineOptions {
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
}

export interface Context {
  getState(): State;
  update<K extends keyof State>(slice: K, patch: Partial<NonNullable<State[K]>>, options?: { silent?: boolean }): void;
  emit<K extends EventName>(name: K, data: EventMap[K]): void;
  on<K extends EventName>(name: K, fn: (event: EngineEvent<K>) => void): () => void;
  fail(action: string, err: unknown): void;
  getPackage(id: number): Package | undefined;
  attribution(): Attribution;
  saved<T>(slice: keyof State): T | undefined;
  forget(slice: 'checkout'): void;
  local: StorageAdapter;
  api: Api;
}

const SNAPSHOT_MAX_AGE = 10 * 60 * 1000;

export class Engine {
  readonly events = new Events();
  readonly cart: CartActions;
  readonly selectors: SelectorActions;
  readonly toggles: ToggleActions;
  checkout?: CheckoutActions;
  order?: OrderActions;
  private state: State;
  private api: Api;
  private session: StorageAdapter;
  private local: StorageAdapter;
  private listeners = new Set<() => void>();
  private notifying = false;
  private ready = false;
  private context: Context;

  constructor(private options: EngineOptions) {
    this.api = new Api(options.apiKey, options.send, options.apiBase);
    const adapter = (name: string, backends: Array<Storage | null>) =>
      new StorageAdapter({
        prefix: options.storagePrefix,
        version: 1,
        backends,
        now: options.now,
        onDegrade: (reason) => this.events.emit('storage.degraded', { reason: `${name}: ${reason}` }),
      });
    this.session = adapter('session', [options.storage.session]);
    this.local = adapter('local', [options.storage.local, options.storage.session]);
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
      on: (name, fn) => this.events.on(name, fn),
      fail: (action, err) => this.fail(action, err),
      getPackage: (id) => this.getPackage(id),
      attribution: () => this.attribution(),
      saved: (slice) => this.session.get(slice),
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
      return this.fail('load', err);
    }
    this.update('campaign', campaign);
    this.events.emit('campaign.loaded', { campaign, fromCache: false });
    void this.cart.campaignLoaded();
    this.selectors.campaignLoaded();
  }

  private markReady(): void {
    if (this.ready || !this.state.campaign) return;
    this.ready = true;
    this.events.emit('ready', { lines: this.cart.lines() });
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
    const { cart, visit, campaign, checkout, order } = this.state;
    if (slice === 'cart') {
      const { groups, coupons, dismissed, shippingId } = cart;
      this.session.set('cart', { groups, coupons, dismissed, shippingId });
    }
    if (slice === 'visit') this.session.set('visit', { ...visit, params: keptParams(visit.params) });
    if (slice === 'campaign') this.local.set(this.campaignKey(), campaign);
    if (slice === 'order' && order) {
      const { refId, order: saved, loadedAt, accepted, coupon } = order;
      this.session.set('order', { refId, order: saved, loadedAt, accepted, coupon });
    }
    if (slice === 'checkout' && checkout) {
      const { fields, phoneE164, sameAsShipping, paymentMethod, step, prospectSaved, pendingRef, failurePath } =
        checkout;
      this.session.set('checkout', {
        fields,
        phoneE164,
        sameAsShipping,
        paymentMethod,
        step,
        prospectSaved,
        pendingRef,
        failurePath,
      });
    }
  }

  private campaignKey(): string {
    return `campaign:${this.options.currency ?? 'default'}`;
  }

  private fail(action: string, err: unknown): void {
    this.events.emit('error', { action, message: err instanceof Error ? err.message : String(err) });
  }
}
