import { Api, type ApiLine } from './api';
import { type Attribution, buildAttribution, type Visit } from './attribution';
import { Events, type EngineEvent } from './events';
import { keptParams } from './params';
import { StorageAdapter } from './storage';
import type { Campaign, CartGroup, CartLine, CartState, EventName, Package, Send, State } from './types';

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
  now?: () => number;
}

const SNAPSHOT_MAX_AGE = 10 * 60 * 1000;

type SavedCart = Pick<CartState, 'groups' | 'coupons' | 'dismissed' | 'shippingId'>;

const emptyCart = (): CartState => ({ groups: {}, coupons: [], dismissed: [], calculating: false });

export function mergeLines(groups: Record<string, CartGroup>): ApiLine[] {
  const merged = new Map<number, number>();
  for (const group of Object.values(groups)) {
    for (const line of group.lines) merged.set(line.packageId, (merged.get(line.packageId) ?? 0) + line.quantity);
  }
  return [...merged].filter(([, q]) => q > 0).map(([package_id, quantity]) => ({ package_id, quantity }));
}

const normalizeCode = (code: string) => code.trim().toUpperCase();

export class Engine {
  readonly events = new Events();
  private api: Api;
  private session: StorageAdapter;
  private persistent: StorageAdapter;
  private state: State;
  private calcSeq = 0;
  private calcAbort?: AbortController;
  private pending?: Promise<void>;

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
    this.persistent = adapter('local', [options.storage.local, options.storage.session]);
    this.state = { cart: emptyCart(), selections: {}, params: options.params ?? {} };
  }

  getState(): Readonly<State> {
    return this.state;
  }

  on<K extends EventName>(
    name: K | '*',
    fn: (event: EngineEvent<K>) => void,
    options?: { replay?: boolean },
  ): () => void {
    return this.events.on(name, fn, options);
  }

  getPackage(id: number): Package | undefined {
    return this.state.campaign?.packages.find((p) => p.ref_id === id);
  }

  lines(): ApiLine[] {
    return mergeLines(this.state.cart.groups);
  }

  restore(): boolean {
    const cart = this.session.get<SavedCart>('cart');
    if (cart) this.state = { ...this.state, cart: { ...emptyCart(), ...cart } };
    const params = { ...this.session.get<Record<string, string>>('params'), ...keptParams(this.state.params) };
    this.session.set('params', params);
    this.state = { ...this.state, params: { ...params, ...this.state.params } };
    const visit = this.session.get<Visit>('visit') ?? this.options.visit;
    if (visit) {
      this.session.set('visit', visit);
      this.state = { ...this.state, visit };
    }
    const campaign = this.persistent.get<Campaign>(this.campaignKey(), SNAPSHOT_MAX_AGE);
    if (campaign) {
      this.state = { ...this.state, campaign };
      this.events.emit('campaign.loaded', { campaign, fromCache: true });
    }
    return !!campaign;
  }

  async load(): Promise<void> {
    let campaign: Campaign;
    try {
      campaign = await this.options.campaign;
    } catch (err) {
      return this.fail('load', err);
    }
    this.state = { ...this.state, campaign };
    this.persistent.set(this.campaignKey(), campaign);
    this.events.emit('campaign.loaded', { campaign, fromCache: false });
    const groups = this.knownPackagesOnly(this.state.cart.groups);
    if (groups !== this.state.cart.groups) void this.commit({ groups });
    else if (this.lines().length) void this.scheduleCalculate();
  }

  attribution(): Attribution {
    return buildAttribution(this.state.params, this.state.visit, this.options.funnel || this.state.campaign?.name);
  }

  readSession<T>(name: string): T | undefined {
    return this.session.get<T>(name);
  }

  writeSession<T>(name: string, value: T): void {
    this.session.set(name, value);
  }

  reset(): void {
    this.session.clear();
    this.persistent.clear();
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
        .map((l) => (l.packageId === packageId ? { ...l, quantity } : l))
        .filter((l) => l.quantity > 0);
      if (lines.length) groups[id] = { ...group, lines };
    }
    return this.commit({ groups });
  }

  removeItem(packageId: number): Promise<void> {
    return this.setQuantity(packageId, 0);
  }

  clear(): Promise<void> {
    return this.commit({ groups: {}, coupons: [], dismissed: [] });
  }

  setGroups(groups: Record<string, CartGroup>): Promise<void> {
    return this.commit({ groups });
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
    if (shippingId === this.state.cart.shippingId) return Promise.resolve();
    const done = this.commit({ shippingId });
    this.events.emit('shipping.changed', { methodId: shippingId });
    return done;
  }

  select(selectorId: string, cardId: string, items: CartLine[]): void {
    if (this.state.selections[selectorId] === cardId) return;
    this.state = { ...this.state, selections: { ...this.state.selections, [selectorId]: cardId } };
    this.events.emit('selection.changed', { selectorId, cardId, items });
  }

  private campaignKey(): string {
    return `campaign:${this.options.currency ?? 'default'}`;
  }

  private knownPackagesOnly(groups: Record<string, CartGroup>): Record<string, CartGroup> {
    const unknown = mergeLines(groups).filter((l) => !this.getPackage(l.package_id));
    if (!unknown.length) return groups;
    this.fail('cart', new Error(`removed unknown package ids ${unknown.map((l) => l.package_id).join(', ')}`));
    const known: Record<string, CartGroup> = {};
    for (const [id, group] of Object.entries(groups)) {
      const lines = group.lines.filter((l) => this.getPackage(l.packageId));
      if (lines.length) known[id] = { ...group, lines };
    }
    return known;
  }

  private commit(patch: Partial<CartState>): Promise<void> {
    const cart: CartState = { ...this.state.cart, ...patch };
    const hasLines = mergeLines(cart.groups).length > 0;
    if (!hasLines) cart.summary = undefined;
    cart.calculating = hasLines && !!this.state.campaign;
    this.state = { ...this.state, cart };
    this.save();
    this.events.emit('cart.updated', { cart });
    return this.scheduleCalculate();
  }

  private save(): void {
    const { groups, coupons, dismissed, shippingId } = this.state.cart;
    this.session.set<SavedCart>('cart', { groups, coupons, dismissed, shippingId });
  }

  private scheduleCalculate(): Promise<void> {
    this.pending ??= Promise.resolve().then(() => {
      this.pending = undefined;
      return this.calculate();
    });
    return this.pending;
  }

  private async calculate(): Promise<void> {
    const seq = ++this.calcSeq;
    this.calcAbort?.abort();
    const lines = this.lines();
    const campaign = this.state.campaign;
    if (!lines.length || !campaign) {
      if (this.state.cart.calculating) this.setCart({ calculating: false });
      return;
    }
    const abort = (this.calcAbort = new AbortController());
    try {
      const summary = await this.api.calculate(
        {
          lines,
          vouchers: this.vouchers(),
          currency: campaign.currency,
          shipping_method: this.state.cart.shippingId,
        },
        abort.signal,
      );
      if (seq !== this.calcSeq) return;
      this.setCart({ summary, calculating: false });
      this.events.emit('cart.calculated', { summary });
    } catch (err) {
      if (seq !== this.calcSeq) return;
      this.setCart({ calculating: false });
      this.fail('calculate', err);
    }
  }

  private vouchers(): string[] {
    const all = new Set(this.state.cart.coupons);
    for (const group of Object.values(this.state.cart.groups)) group.vouchers.forEach((v) => all.add(normalizeCode(v)));
    return [...all];
  }

  private setCart(patch: Partial<CartState>): void {
    const cart = { ...this.state.cart, ...patch };
    this.state = { ...this.state, cart };
    this.events.emit('cart.updated', { cart });
  }

  private fail(action: string, err: unknown): void {
    this.events.emit('error', { action, message: err instanceof Error ? err.message : String(err) });
  }
}
