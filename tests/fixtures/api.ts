import type { CartSummary } from '../../src/engine/types';
import { campaign } from './campaign';

export interface Call {
  url: string;
  method: string;
  headers: Record<string, string>;
  body?: any;
}

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
    const offer = url.includes('upsell=true') ? 0.5 : 1;
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
          total_discount: (gross * (1 - offer)).toFixed(2),
          total: (gross * offer).toFixed(2),
          discounts: [],
        };
      }),
      offer_discounts: [],
      voucher_discounts: discount
        ? [{ name: 'SAVE10', description: 'SAVE10', amount: '10.00', percentage: '10.00' }]
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
