import { afterEach, describe, expect, it, vi } from 'vitest';
import { checks, eventFlow } from '../../src/debug/events';
import { nodes } from '../../src/debug/view';
import type { AnalyticsEvent, CartSummary } from '../../src/engine/types';
import { makeEngine } from '../fixtures/engine';

const event = (name: string, params: Record<string, unknown>, id = `${name}_1`) =>
  ({ name, id, time: '', params, context: {} }) as unknown as AnalyticsEvent;

const EARBUDS = { item_id: '11', item_name: 'Earbuds ×1', quantity: 1, price: 49 };

function setup() {
  const { engine } = makeEngine();
  const root = document.createElement('div');
  const ids = new WeakMap<object, number>();
  let seq = 0;
  const idOf = (o: object) => {
    if (!ids.has(o)) ids.set(o, ++seq);
    return ids.get(o)!;
  };
  const flow = eventFlow(engine, { open: new Set(), idOf, render: () => paint() });
  const paint = () => root.replaceChildren(...nodes(flow.view('')));
  engine.on('*', flow.record);
  const step = (label: string) => [...root.querySelectorAll('.step')].find((s) => s.textContent!.endsWith(label))!;
  const button = (text: string) => [...root.querySelectorAll('button')].find((b) => b.textContent === text)!;
  return { engine, flow, root, paint, step, button };
}

afterEach(() => {
  delete (window as { NextDataLayer?: unknown }).NextDataLayer;
  delete (window as { dataLayer?: unknown }).dataLayer;
});

describe('events and analytics flow', () => {
  it('puts each analytics event under the SDK event that sent it, with its data layer push', async () => {
    const { engine, root, paint, step } = setup();
    (window as { NextDataLayer?: unknown[] }).NextDataLayer = [{ event: 'dl_add_to_cart', event_id: 'atc_1' }];
    engine.on('cart.calculated', () =>
      engine.events.emit('analytics', event('add_to_cart', { currency: 'USD', value: 49, items: [EARBUDS] }, 'atc_1')),
    );
    engine.events.emit('cart.calculated', { summary: {} as CartSummary });
    paint();
    const moment = root.querySelector('.ga-row')!.closest('.moment')!;
    expect(moment.querySelector('.sdk-name')!.textContent).toBe('cart.calculated');
    expect(moment.querySelector('.ga-row summary')!.textContent).toBe(
      'add_to_cart $49.00 · 1 item→ dl_add_to_cart✓ GA4',
    );
    expect(step('Add to cart').classList.contains('fired')).toBe(true);
    expect(step('Checkout').classList.contains('fired')).toBe(false);
    root.querySelector<HTMLDetailsElement>('.ga-row')!.open = true;
    await vi.waitFor(() => expect(root.querySelector('.ga-body')).not.toBeNull());
    const body = root.querySelector('.ga-body')!.textContent!;
    expect(body).toContain('Earbuds ×1');
    expect(body).toContain('✓ Required GA4 fields are present');
    expect(body).toContain('NextDataLayer ✓ dl_add_to_cart');
    expect(body).toContain('dataLayer not on page');
  });

  it('flags missing GA4 fields and a purchase sent twice', () => {
    const { engine, root, paint, step } = setup();
    engine.events.emit('analytics', event('purchase', { value: 10, items: [] }, 'p1'));
    engine.events.emit('analytics', event('purchase', { value: 10, items: [] }, 'p2'));
    paint();
    expect(root.querySelector('.ga-row .fail')!.textContent).toBe('⚠ 3');
    expect(step('Purchase').className).toBe('step fired twice');
    expect(step('Purchase').textContent).toBe('2Purchase');
  });

  it('checks what GA4 requires', () => {
    expect(checks('page_view', { page_title: 'x' })).toEqual([]);
    expect(checks('add_to_cart', { currency: 'USD', value: 49, items: [EARBUDS] })).toEqual([]);
    expect(checks('add_to_cart', { value: 49, items: [{ quantity: 1 }] })).toEqual([
      'an item has neither item_id nor item_name',
      'value is set without currency',
    ]);
    expect(checks('upsell_purchase', { currency: 'USD', items: [EARBUDS] })).toEqual(['transaction_id is missing']);
  });

  it('shows only SDK events, only analytics, or one funnel step', async () => {
    const { engine, root, paint, step, button } = setup();
    engine.events.emit('coupon.refused', { code: 'NOPE' });
    await Promise.resolve();
    engine.events.emit('analytics', event('page_view', {}));
    engine.events.emit('analytics', event('add_to_cart', { currency: 'USD', value: 49, items: [EARBUDS] }));
    paint();
    const names = () => [...root.querySelectorAll('.sdk-name, .ga-name')].map((n) => n.textContent);
    expect(names()).toEqual(['page_view', 'add_to_cart', 'coupon.refused']);
    expect(root.querySelector('.when')!.textContent).toMatch(/· no SDK event alongside$/);
    button('SDK').click();
    expect(names()).toEqual(['coupon.refused']);
    button('Analytics').click();
    expect(names()).toEqual(['page_view', 'add_to_cart']);
    (step('Page view') as HTMLElement).click();
    expect(names()).toEqual(['page_view']);
    expect(step('Page view').classList.contains('focus')).toBe(true);
  });

  it('explains an empty timeline', () => {
    const { root, paint, button } = setup();
    paint();
    expect(root.textContent).toContain('No events yet');
    button('Analytics').click();
    expect(root.textContent).toContain('No analytics events here yet');
  });
});
