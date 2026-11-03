import { afterEach, describe, expect, it, vi } from 'vitest';
import { checks, eventFlow } from '../../src/debug/events';
import { nodes } from '../../src/debug/view';
import type { AnalyticsEvent } from '../../src/engine/types';
import { makeEngine } from '../fixtures/engine';

const event = (name: string, params: Record<string, unknown>, id = `${name}_1`) =>
  ({ name, id, time: '', params, context: {} }) as unknown as AnalyticsEvent;

const EARBUDS = { item_id: '11', item_name: 'Earbuds', quantity: 1, price: 49 };

type Layers = { NextDataLayer?: unknown[]; dataLayer?: unknown[] };

function setup() {
  const { engine } = makeEngine();
  const root = document.createElement('div');
  const ids = new WeakMap<object, number>();
  let seq = 0;
  const idOf = (o: object) => {
    if (!ids.has(o)) ids.set(o, ++seq);
    return ids.get(o)!;
  };
  const flow = eventFlow({ open: new Set(), idOf, render: () => paint() });
  const paint = () => root.replaceChildren(...nodes(flow.view('')));
  engine.on('*', flow.record);
  const step = (label: string) => [...root.querySelectorAll('.step')].find((s) => s.textContent!.endsWith(label))!;
  const heads = () => [...root.querySelectorAll('.story-head > :first-child')].map((s) => s.textContent);
  const rows = () =>
    [...root.querySelectorAll('.ga-row > summary')].map((s) => [...s.children].map((c) => c.textContent));
  return { engine, root, paint, step, heads, rows };
}

afterEach(() => {
  vi.useRealTimers();
  delete (window as Layers).NextDataLayer;
  delete (window as Layers).dataLayer;
});

describe('events and analytics flow', () => {
  it('tells what the shopper did, then what GA4 got for it', async () => {
    const { engine, root, paint, step, heads, rows } = setup();
    (window as Layers).NextDataLayer = [
      { event: 'dl_add_to_cart', event_id: 'atc' },
      { event: 'dl_cart_updated', event_id: 'uc' },
    ];
    engine.events.emit('selection.changed', { selectorId: 'main', cardId: 'bundle-2x', items: [] });
    engine.events.emit('cart.updated', { cart: {} as never });
    engine.events.emit('analytics', event('add_to_cart', { currency: 'USD', value: 49, items: [EARBUDS] }, 'atc'));
    engine.events.emit(
      'analytics',
      event('update_cart', { currency: 'USD', value: 98, items: [{ ...EARBUDS, quantity: 2 }] }, 'uc'),
    );
    paint();
    expect(heads()).toEqual(['Picked bundle-2x']);
    expect(rows()).toEqual([
      ['add_to_cart', '+ Earbuds ×1', '$49.00', '✓'],
      ['update_cart', 'Earbuds ×2', '$98.00', '✓'],
    ]);
    expect(root.querySelector('.status')!.textContent).toBe(
      '2 GA4 events✓ required fields presentNextDataLayer 2/2dataLayer not on page',
    );
    expect(step('Add to cart').classList.contains('fired')).toBe(true);
    expect(step('Checkout').classList.contains('fired')).toBe(false);
    root.querySelector<HTMLDetailsElement>('.ga-row')!.open = true;
    await vi.waitFor(() => expect(root.querySelector('.ga-body')).not.toBeNull());
    const body = root.querySelector('.ga-body')!.textContent!;
    expect(body).toContain('Earbuds11149');
    expect(body).toContain('✓ Required GA4 fields are present');
    expect(body).toContain('NextDataLayer ✓ dl_add_to_cart');
    expect(body).toContain('dataLayer not pushed');
  });

  it('starts a new card after a pause, oldest first, and marks actions that sent nothing to GA4', () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    const { engine, root, paint, heads } = setup();
    vi.setSystemTime(10_000);
    engine.events.emit('exit-intent.shown', {} as never);
    vi.setSystemTime(20_000);
    engine.events.emit('checkout.started', { lines: [] });
    engine.events.emit('analytics', event('begin_checkout', { currency: 'USD', value: 49, items: [EARBUDS] }));
    paint();
    expect(heads()).toEqual(['Exit popup shown · no GA4 event', 'Started checkout']);
    expect(root.querySelector('.story')!.classList.contains('quiet')).toBe(true);
  });

  it('flags missing GA4 fields, a missing push and a purchase sent twice', () => {
    const { engine, root, paint, step, rows } = setup();
    (window as Layers).NextDataLayer = [{ event: 'dl_purchase', event_id: 'p1' }];
    engine.events.emit('analytics', event('purchase', { value: 10, items: [] }, 'p1'));
    engine.events.emit('analytics', event('purchase', { value: 10, items: [] }, 'p2'));
    paint();
    expect(rows().map((r) => r[3])).toEqual(['⚠', '⚠']);
    expect(root.querySelectorAll<HTMLElement>('.fail')[1]!.title).toBe(
      'items is empty\nvalue is set without currency\ntransaction_id is missing\nnot in NextDataLayer',
    );
    expect(root.querySelector('.status')!.textContent).toContain('⚠ 2 missing required fields');
    expect(root.querySelector('.status')!.textContent).toContain('NextDataLayer 1/2');
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

  it('shows SDK events on request, and one funnel step at a time', () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    const { engine, root, paint, step, heads, rows } = setup();
    vi.setSystemTime(10_000);
    engine.events.emit('coupon.refused', { code: 'NOPE' });
    vi.setSystemTime(20_000);
    engine.events.emit('selection.changed', { selectorId: 'main', cardId: 'bundle-1x', items: [] });
    engine.events.emit('ready', { lines: [] });
    engine.events.emit('analytics', event('page_view', { page_title: 'Olympus' }));
    engine.events.emit('analytics', event('add_to_cart', { currency: 'USD', value: 49, items: [EARBUDS] }));
    paint();
    expect(heads()).toEqual(['Coupon NOPE refused · no GA4 event', 'Page ready · Picked bundle-1x']);
    expect(root.querySelector('.sdk-name')).toBeNull();
    const toggle = root.querySelector<HTMLInputElement>('.switch input')!;
    toggle.checked = true;
    toggle.dispatchEvent(new Event('change'));
    expect([...root.querySelectorAll('.sdk-name')].map((n) => n.textContent)).toEqual([
      'coupon.refused',
      'selection.changed',
      'ready',
    ]);
    (step('Page view') as HTMLElement).click();
    expect(heads()).toEqual(['Page ready · Picked bundle-1x']);
    expect(rows().map((r) => r[0])).toEqual(['page_view']);
    expect(rows()[0]![1]).toBe('Olympus');
    expect(root.querySelector('.controls')!.textContent).toContain('Only Page view Show all');
    root.querySelector<HTMLElement>('.controls .link')!.click();
    expect(rows().map((r) => r[0])).toEqual(['page_view', 'add_to_cart']);
  });

  it('explains an empty timeline and a step that never fired', () => {
    const { root, paint, step } = setup();
    paint();
    expect(root.textContent).toContain('No events yet');
    expect(root.querySelector('.status')!.textContent).toBe('No GA4 events yet');
    (step('Purchase') as HTMLElement).click();
    expect(root.textContent).toContain('No purchase event on this page');
  });
});
