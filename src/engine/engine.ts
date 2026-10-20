import { Api, type ApiLine } from './api';
import { Events, type EngineEvent } from './events';
import type { StorageAdapter } from './storage';
import type { Campaign, CartGroup, CartState, CartSummary, EventName, Package, State } from './types';

export interface EngineOptions {
  apiKey: string;
  storage: StorageAdapter;
  fetch: typeof fetch;
  apiBase: string;
  currency?: string;
  params?: Record<string, string>;
  prefetchedCampaign?: Promise<Campaign>;
}

const CART_KEY = 'cart';
const CAMPAIGN_KEY = 'campaign';
const CART_MAX_AGE = 7 * 24 * 3600 * 1000;
const SNAPSHOT_MAX_AGE = 24 * 3600 * 1000;
const STORAGE_VERSION = 1;

export const ENGINE_STORAGE_VERSION = STORAGE_VERSION;

type PersistedCart = Pick<CartState, 'groups' | 'coupons' | 'dismissed' | 'shippingId' | 'summary'>;

function emptyCart(): CartState {
  return { groups: {}, coupons: [], dismissed: [], calculating: false };
}

export function mergeLines(groups: Record<string, CartGroup>): ApiLine[] {
  const merged = new Map<number, number>();
  for (const group of Object.values(groups)) {
    for (const line of group.lines) merged.set(line.packageId, (merged.get(line.packageId) ?? 0) + line.quantity);
  }
  return [...merged].filter(([, q]) => q > 0).map(([package_id, quantity]) => ({ package_id, quantity }));
}

export function normalizeCode(code: string): string {
  return code.trim().toUpperCase();
}

export class Engine {
  readonly events = new Events();
  private api: Api;
  private state: State;
  private calcSeq = 0;
  private calcAbort?: AbortController;
  private calcScheduled = false;
  private calcDone?: Promise<void>;

  constructor(private options: EngineOptions) {
    this.api = new Api(options.apiKey, options.fetch, options.apiBase);
    this.state = { cart: emptyCart(), selections: {}, params: options.params ?? {} };
  }

  getState(): Readonly<State> {
    return this.state;
  }

  on(name: EventName | '*', fn: (event: EngineEvent) => void, options?: { replay?: boolean }): () => void {
    return this.events.on(name, fn, options);
  }

  getPackage(id: number): Package | undefined {
    return this.state.campaign?.packages.find((p) => p.ref_id === id);
  }

  lines(): ApiLine[] {
    return mergeLines(this.state.cart.groups);
  }

  vouchers(): string[] {
    const all = new Set(this.state.cart.coupons);
    for (const group of Object.values(this.state.cart.groups)) group.vouchers.forEach((v) => all.add(v));
    return [...all];
  }

  restore(): boolean {
    const { storage } = this.options;
    const cart = storage.get<PersistedCart>(CART_KEY, 'local', CART_MAX_AGE);
    if (cart) this.state.cart = { ...emptyCart(), ...cart };
    const campaign = storage.get<Campaign>(this.campaignKey(), 'local', SNAPSHOT_MAX_AGE);
    if (campaign) {
      this.state.campaign = campaign;
      this.events.emit('campaign.loaded', { campaign, fromCache: true });
    }
    return !!campaign;
  }

  async load(): Promise<void> {
    try {
      const campaign = await (this.options.prefetchedCampaign ?? this.api.getCampaign(this.options.currency));
      this.state.campaign = campaign;
      this.options.storage.set(this.campaignKey(), campaign, 'local');
      this.events.emit('campaign.loaded', { campaign, fromCache: false });
      if (this.lines().length) await this.calculate();
    } catch (err) {
      this.fail('load', err);
    }
  }

  setGroup(id: string, group: CartGroup | null, options: { dismiss?: boolean } = {}): Promise<void> {
    const groups = { ...this.state.cart.groups };
    const keep = !!group && group.lines.some((l) => l.quantity > 0);
    if (keep) groups[id] = group;
    else delete groups[id];
    const dismissed = this.state.cart.dismissed.filter((d) => d !== id);
    if (!keep && options.dismiss) dismissed.push(id);
    return this.commit({ groups, dismissed });
  }

  addItem(packageId: number, quantity = 1, groupId = 'items'): Promise<void> {
    const current = this.state.cart.groups[groupId] ?? { lines: [], vouchers: [] };
    const existing = current.lines.find((l) => l.packageId === packageId);
    const lines = existing
      ? current.lines.map((l) => (l.packageId === packageId ? { ...l, quantity: l.quantity + quantity } : l))
      : [...current.lines, { packageId, quantity }];
    return this.setGroup(groupId, { ...current, lines });
  }

  setQuantity(packageId: number, quantity: number): Promise<void> {
    const groups: Record<string, CartGroup> = {};
    for (const [id, group] of Object.entries(this.state.cart.groups)) {
      const lines = group.lines
        .map((l) => (l.packageId === packageId ? { ...l, quantity: Math.max(0, quantity) } : l))
        .filter((l) => l.quantity > 0);
      if (lines.length) groups[id] = { ...group, lines };
    }
    return this.commit({ groups });
  }

  removeItem(packageId: number): Promise<void> {
    return this.setQuantity(packageId, 0);
  }

  clear(): Promise<void> {
    return this.commit({ groups: {}, coupons: [], dismissed: [], summary: undefined });
  }

  applyCoupon(code: string): Promise<void> {
    const normalized = normalizeCode(code);
    if (!normalized || this.state.cart.coupons.includes(normalized)) return Promise.resolve();
    return this.commit({ coupons: [...this.state.cart.coupons, normalized] });
  }

  removeCoupon(code: string): Promise<void> {
    const normalized = normalizeCode(code);
    return this.commit({ coupons: this.state.cart.coupons.filter((c) => c !== normalized) });
  }

  setShipping(shippingId: number | undefined): Promise<void> {
    return this.commit({ shippingId });
  }

  select(selectorId: string, cardId: string): void {
    if (this.state.selections[selectorId] === cardId) return;
    this.state = { ...this.state, selections: { ...this.state.selections, [selectorId]: cardId } };
    this.events.emit('selection.changed', { selectorId, cardId });
  }

  private campaignKey(): string {
    return `${CAMPAIGN_KEY}:${this.options.currency ?? 'default'}`;
  }

  private commit(patch: Partial<CartState>): Promise<void> {
    const cart = { ...this.state.cart, ...patch };
    if (!mergeLines(cart.groups).length) cart.summary = undefined;
    this.state = { ...this.state, cart };
    this.persist();
    this.events.emit('cart.updated', { cart });
    return this.scheduleCalculate();
  }

  private persist(): void {
    const { groups, coupons, dismissed, shippingId, summary } = this.state.cart;
    this.options.storage.set<PersistedCart>(CART_KEY, { groups, coupons, dismissed, shippingId, summary }, 'local');
  }

  private scheduleCalculate(): Promise<void> {
    if (!this.calcScheduled) {
      this.calcScheduled = true;
      this.calcDone = Promise.resolve().then(() => {
        this.calcScheduled = false;
        return this.calculate();
      });
    }
    return this.calcDone ?? Promise.resolve();
  }

  private async calculate(): Promise<void> {
    const lines = this.lines();
    if (!lines.length || !this.state.campaign) return;
    const seq = ++this.calcSeq;
    this.calcAbort?.abort();
    const abort = (this.calcAbort = new AbortController());
    this.setCalculating(true);
    try {
      const summary: CartSummary = await this.api.calculate(
        {
          lines,
          vouchers: this.vouchers(),
          currency: this.state.campaign.currency,
          shipping_method: this.state.cart.shippingId,
        },
        abort.signal,
      );
      if (seq !== this.calcSeq) return;
      this.state = { ...this.state, cart: { ...this.state.cart, summary, calculating: false } };
      this.persist();
      this.events.emit('cart.calculated', { summary });
      this.events.emit('cart.updated', { cart: this.state.cart });
    } catch (err) {
      if (seq !== this.calcSeq || abort.signal.aborted) return;
      this.setCalculating(false);
      this.fail('calculate', err);
    }
  }

  private setCalculating(calculating: boolean): void {
    this.state = { ...this.state, cart: { ...this.state.cart, calculating } };
  }

  private fail(action: string, err: unknown): void {
    this.events.emit('error', { action, message: err instanceof Error ? err.message : String(err) });
  }
}
