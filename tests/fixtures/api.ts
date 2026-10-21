import type { CartSummary } from '../../src/engine/types';
import { campaign } from './campaign';
import { ORDER, withUpsell } from './order';

export interface Call {
  url: string;
  method: string;
  headers: Record<string, string>;
  body?: any;
}

export interface FakeApiOptions {
  delays?: number[];
  ignoreAbort?: boolean;
  order?: (body: any) => Response;
  getOrder?: (ref: string) => Response;
  upsell?: (ref: string, body: any) => Response;
  offers?: Record<number, number>;
}

export const json = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status });

export function fakeApi(options: FakeApiOptions = {}) {
  const calls: Call[] = [];
  const fetchImpl = (async (input: RequestInfo | URL, init: RequestInit = {}) => {
    const url = String(input);
    const body = init.body ? JSON.parse(String(init.body)) : undefined;
    calls.push({ url, method: init.method ?? 'GET', headers: init.headers as Record<string, string>, body });
    const delay = options.delays?.[calls.length - 1] ?? 0;
    if (delay) await new Promise((r) => setTimeout(r, delay));
    if (init.signal?.aborted && !options.ignoreAbort) throw new DOMException('aborted', 'AbortError');
    const upsell = url.match(/\/orders\/([^/]+)\/upsells\/$/);
    if (upsell) return options.upsell?.(upsell[1]!, body) ?? json(withUpsell(ORDER, 99, body.lines[0].quantity));
    const order = url.match(/\/orders\/([^/]+)\/$/);
    if (order) return options.getOrder?.(order[1]!) ?? json({ ...ORDER, ref_id: order[1] });
    if (url.endsWith('/orders/')) {
      return options.order?.(body) ?? json({ ref_id: 'R1', order_status_url: 'https://shop.test/status/R1' });
    }
    if (url.endsWith('/carts/')) return json({ id: 7, checkout_url: 'https://shop.test/c/7' });
    const lines = body.lines as Array<{ package_id: number; quantity: number }>;
    const upsellPrice = url.includes('upsell=true');
    const rate = (packageId: number) => (upsellPrice ? 0.5 : 1 - (options.offers?.[packageId] ?? 0));
    const subtotal = lines.reduce(
      (n, l) => n + Number(campaign.packages.find((p) => p.ref_id === l.package_id)!.price_total) * l.quantity,
      0,
    );
    const discount = (body.vouchers as string[]).includes('SAVE10') ? 10 : 0;
    const summary: CartSummary = {
      lines: lines.map((l) => {
        const p = campaign.packages.find((x) => x.ref_id === l.package_id)!;
        const gross = Number(p.price_total) * l.quantity;
        return {
          package_id: l.package_id,
          quantity: l.quantity,
          unit_price: p.price,
          original_unit_price: p.price_retail ?? p.price,
          package_price: p.price_total,
          original_package_price: p.price_retail_total ?? p.price_total,
          subtotal: gross.toFixed(2),
          total_discount: (gross * (1 - rate(l.package_id))).toFixed(2),
          total: (gross * rate(l.package_id)).toFixed(2),
          discounts: discount ? [{ offer_id: 10, name: 'SAVE10', amount: '1.00', percentage: '10.00' }] : [],
        };
      }),
      offer_discounts: [],
      voucher_discounts: discount
        ? [{ offer_id: 10, name: 'SAVE10', description: 'SAVE10', amount: '10.00', percentage: '10.00' }]
        : [],
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
