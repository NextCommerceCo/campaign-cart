import { Engine } from '../src/engine/engine';
import { StorageAdapter } from '../src/engine/storage';
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

/** A memory-backed Web Storage, optionally broken the way Safari private mode is. */
export class MemoryStorage implements Storage {
  private data = new Map<string, string>();
  constructor(private broken = false) {}
  get length() { return this.data.size; }
  key(i: number) { return [...this.data.keys()][i] ?? null; }
  getItem(k: string) { return this.data.get(k) ?? null; }
  setItem(k: string, v: string) {
    if (this.broken) throw Object.assign(new Error('quota'), { name: 'QuotaExceededError' });
    this.data.set(k, v);
  }
  removeItem(k: string) { this.data.delete(k); }
  clear() { this.data.clear(); }
}

export interface Call { url: string; method: string; body?: any }

/**
 * A fake Campaign App. `/carts/calculate` answers with totals computed from the
 * catalog so tests can assert on real-looking numbers.
 */
export function fakeApi(options: { delayMs?: number } = {}) {
  const calls: Call[] = [];
  const fetchImpl = (async (input: RequestInfo | URL, init: RequestInit = {}) => {
    const url = String(input);
    const body = init.body ? JSON.parse(String(init.body)) : undefined;
    calls.push({ url, method: init.method ?? 'GET', body });
    if (options.delayMs) await new Promise((r) => setTimeout(r, options.delayMs));
    if (init.signal?.aborted) throw new DOMException('aborted', 'AbortError');
    if (url.includes('/campaigns/')) return new Response(JSON.stringify(campaign));
    if (url.includes('/carts/calculate/')) {
      const subtotal = (body.lines as Array<{ package_id: number; quantity: number }>).reduce((n, l) => {
        const p = campaign.packages.find((x) => x.ref_id === l.package_id)!;
        return n + Number(p.price_total) * l.quantity;
      }, 0);
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
    }
    return new Response('{}', { status: 404 });
  }) as typeof fetch;
  return { calls, fetch: fetchImpl, calculates: () => calls.filter((c) => c.url.includes('/calculate/')) };
}

export function makeEngine(opts: { local?: Storage; fetch?: typeof fetch; prefetched?: Promise<Campaign> } = {}) {
  const api = fakeApi();
  const local = opts.local ?? new MemoryStorage();
  const storage = new StorageAdapter({ prefix: 'next:test', version: 1, local, session: new MemoryStorage() });
  const engine = new Engine({
    apiKey: 'pk_test',
    apiBase: 'https://api.test',
    storage,
    fetch: opts.fetch ?? api.fetch,
    prefetchedCampaign: opts.prefetched,
  });
  return { engine, api, local, storage };
}

export const flush = () => new Promise((r) => setTimeout(r, 0));
