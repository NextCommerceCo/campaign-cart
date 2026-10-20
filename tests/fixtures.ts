import { Engine } from '../src/engine/engine';
import type { Campaign, CartSummary } from '../src/engine/types';

export const campaign: Campaign = {
  name: 'Olympus',
  currency: 'USD',
  language: 'en',
  shipping_methods: [{ ref_id: 1, code: 'standard', price: '0.00' }],
  packages: [
    { ref_id: 1, external_id: 11, name: 'Earbuds ×1', price: '49.00', price_total: '49.00', price_retail: '99.00', price_retail_total: '99.00', qty: 1, image: 'https://cdn.test/1.png', is_recurring: false },
    { ref_id: 2, external_id: 12, name: 'Earbuds ×2', price: '44.50', price_total: '89.00', price_retail: '99.00', price_retail_total: '198.00', qty: 2, image: 'https://cdn.test/2.png', is_recurring: false },
    { ref_id: 9, external_id: 19, name: 'Protection plan', price: '9.00', price_total: '9.00', qty: 1, image: 'https://cdn.test/9.png', is_recurring: false },
  ],
};

export class MemoryStorage implements Storage {
  data = new Map<string, string>();
  constructor(public failWrites: 'never' | 'always' | 'after-probe' = 'never') {}
  get length() { return this.data.size; }
  key(i: number) { return [...this.data.keys()][i] ?? null; }
  getItem(k: string) { return this.data.get(k) ?? null; }
  setItem(k: string, v: string) {
    const probe = k === '__next_probe__';
    if (this.failWrites === 'always' || (this.failWrites === 'after-probe' && !probe)) {
      throw Object.assign(new Error('quota'), { name: 'QuotaExceededError' });
    }
    this.data.set(k, v);
  }
  removeItem(k: string) { this.data.delete(k); }
  clear() { this.data.clear(); }
}

export interface Call { url: string; method: string; headers: Record<string, string>; body?: any }

export function fakeApi(options: { delays?: number[]; ignoreAbort?: boolean } = {}) {
  const calls: Call[] = [];
  const fetchImpl = (async (input: RequestInfo | URL, init: RequestInit = {}) => {
    const url = String(input);
    const body = init.body ? JSON.parse(String(init.body)) : undefined;
    calls.push({ url, method: init.method ?? 'GET', headers: init.headers as Record<string, string>, body });
    const delay = options.delays?.[calls.length - 1] ?? 0;
    if (delay) await new Promise((r) => setTimeout(r, delay));
    if (init.signal?.aborted && !options.ignoreAbort) throw new DOMException('aborted', 'AbortError');
    const lines = body.lines as Array<{ package_id: number; quantity: number }>;
    const subtotal = lines.reduce((n, l) => n + Number(campaign.packages.find((p) => p.ref_id === l.package_id)!.price_total) * l.quantity, 0);
    const discount = (body.vouchers as string[]).includes('SAVE10') ? 10 : 0;
    const summary: CartSummary = {
      lines: [],
      offer_discounts: [],
      voucher_discounts: discount ? [{ name: 'SAVE10', amount: '10.00' }] : [],
      subtotal: subtotal.toFixed(2),
      total_discount: discount.toFixed(2),
      total: (subtotal - discount).toFixed(2),
      currency: 'USD',
      shipping_method: { id: 1, name: 'Standard', code: 'standard', price: '0.00', original_price: '0.00' },
    };
    return new Response(JSON.stringify(summary));
  }) as typeof fetch;
  return { calls, fetch: fetchImpl };
}

export interface MakeEngine {
  local?: Storage;
  session?: Storage;
  fetch?: typeof fetch;
  campaign?: Promise<Campaign>;
  now?: () => number;
}

export function makeEngine(opts: MakeEngine = {}) {
  const api = fakeApi();
  const local = opts.local ?? new MemoryStorage();
  const session = opts.session ?? new MemoryStorage();
  const engine = new Engine({
    apiKey: 'pk_test',
    apiBase: 'https://api.test',
    fetch: opts.fetch ?? api.fetch,
    campaign: opts.campaign ?? Promise.resolve(campaign),
    storagePrefix: 'next:test',
    storage: [local, session],
    now: opts.now,
  });
  return { engine, api, local, session };
}

export const flush = () => new Promise((r) => setTimeout(r, 0));
export const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));
