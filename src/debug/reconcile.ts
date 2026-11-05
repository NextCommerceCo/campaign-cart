import type { AnalyticsEvent } from '../engine/events/analytics';
import type { EngineEvent, EventMap } from '../engine/events/bus';
import { format } from '../engine/format';

export interface Sum {
  ok: boolean;
  text: string;
}

export const paramsOf = (event: AnalyticsEvent) => event.params as Record<string, unknown>;

const money = (value: number, currency: unknown) =>
  format({ type: 'money', value }, currency ? String(currency) : undefined);
export const amount = (params: Record<string, unknown>) =>
  typeof params.value === 'number' ? money(params.value, params.currency) : '';
const near = (a: number, b: number) => Math.abs(a - b) <= Math.max(0.01, Math.abs(b) * 0.005);
const total = (amounts: Array<string | number | undefined>) => amounts.reduce((n: number, v) => n + Number(v ?? 0), 0);

export const addsUp = (event: AnalyticsEvent, trigger: EngineEvent): Sum | undefined => {
  const params = paramsOf(event);
  const { value, currency } = params;
  if (typeof value !== 'number') return undefined;
  const m = (n: number) => money(n, currency);
  if (event.name === 'update_cart' && trigger.name === 'cart.calculated') {
    const cart = trigger.data as EventMap['cart.calculated'];
    if (cart.total === undefined) return undefined;
    const lines = total(cart.lines.map((l) => l.total));
    const voucher = total((cart.discounts ?? []).filter((d) => d.source === 'coupon').map((d) => d.amount));
    if (near(value, lines)) return { ok: true, text: `value ${m(value)} = the cart lines ${m(lines)}` };
    if (voucher && near(value, lines + voucher))
      return {
        ok: true,
        text: `value ${m(value)} = the cart lines ${m(lines)} before the ${m(voucher)} voucher, sent as coupon`,
      };
    return { ok: false, text: `value ${m(value)}, but the cart lines come to ${m(lines)}` };
  }
  if (event.name === 'purchase' && trigger.name === 'order.paid') {
    const order = trigger.data as EventMap['order.paid'];
    if (!order.total) return undefined;
    const due = order.total - total(order.lines.filter((l) => l.upsell).map((l) => l.total));
    const shipping = Number(params.shipping ?? 0);
    const tax = Number(params.tax ?? 0);
    if (near(value + shipping, due))
      return {
        ok: true,
        text: `value ${m(value)} + shipping ${m(shipping)} = ${m(due)}, the order total (prices include tax)`,
      };
    const sum = `value ${m(value)} + shipping ${m(shipping)} + tax ${m(tax)} = ${m(value + shipping + tax)}`;
    return near(value + shipping + tax, due)
      ? { ok: true, text: `${sum}, the order total` }
      : { ok: false, text: `${sum}, but the order total is ${m(due)}` };
  }
  return undefined;
};
