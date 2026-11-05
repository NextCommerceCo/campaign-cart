import { describe, expect, it } from 'vitest';
import type { AnalyticsEvent } from '../../src/engine/events/analytics';
import type { EngineEvent } from '../../src/engine/events/bus';
import type { EventContext } from '../../src/engine/events/context';
import { addsUp, amount } from '../../src/debug/reconcile';

const sent = (name: string, params: Record<string, unknown>) =>
  ({ name, id: 'a1', time: '', params, context: {} as EventContext }) as AnalyticsEvent;
const engineEvent = (name: string, data: unknown) => ({ id: 'e1', name, data, at: 0 }) as EngineEvent;

describe('reconcile', () => {
  it('shows an event value in its currency', () => {
    expect(amount({ value: 12.5, currency: 'USD' })).toBe('$12.50');
    expect(amount({})).toBe('');
  });

  it('checks update_cart against the cart lines', () => {
    const cart = engineEvent('cart.calculated', { total: 49, lines: [{ total: 49 }], discounts: [] });
    expect(addsUp(sent('update_cart', { value: 49, currency: 'USD' }), cart)).toEqual({
      ok: true,
      text: 'value $49.00 = the cart lines $49.00',
    });
    expect(addsUp(sent('update_cart', { value: 59, currency: 'USD' }), cart)?.ok).toBe(false);
  });

  it('checks purchase against the order total without its upsells', () => {
    const order = engineEvent('order.paid', {
      total: 110,
      lines: [
        { total: 100, upsell: false },
        { total: 20, upsell: true },
      ],
    });
    const purchase = (value: number, tax: number) =>
      addsUp(sent('purchase', { value, shipping: 10, tax, currency: 'USD' }), order);
    expect(purchase(80, 0)).toEqual({
      ok: true,
      text: 'value $80.00 + shipping $10.00 = $90.00, the order total (prices include tax)',
    });
    expect(purchase(75, 5)?.text).toBe('value $75.00 + shipping $10.00 + tax $5.00 = $90.00, the order total');
    expect(purchase(70, 0)?.ok).toBe(false);
  });

  it('only checks the pairs it knows', () => {
    expect(addsUp(sent('add_to_cart', { value: 1 }), engineEvent('cart.added', {}))).toBeUndefined();
  });
});
