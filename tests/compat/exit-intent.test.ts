import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { exitIntent } from '../../src/compat/exit-intent';
import { flush, makeEngine } from '../fixtures/engine';

const IMAGE = 'https://cdn.test/exit.png';
const TEMPLATE = `<template data-template="exit-offer">
  <button data-exit-intent-action="apply-coupon" data-coupon-code="SAVE10">Take 10% off</button>
  <button data-exit-intent-action="custom">Custom</button>
</template>`;

const leave = () => document.dispatchEvent(new MouseEvent('mouseout', { clientY: -1, relatedTarget: null }));
const click = (selector: string) => document.querySelector<HTMLElement>(selector)!.click();
const escape = () => document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));

async function popup(html = '') {
  document.body.innerHTML = html;
  const { engine } = makeEngine();
  await engine.start();
  const seen: Array<[string, unknown]> = [];
  engine.events.on('*', (e) => {
    if (/^(promotion|coupon)\./.test(e.name)) seen.push([e.name, e.data]);
  });
  return { engine, seen, names: () => seen.map(([name]) => name) };
}

beforeEach(() => vi.stubGlobal('matchMedia', () => ({ matches: false })));

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  document.body.innerHTML = '';
});

describe('exitIntent promotion', () => {
  it('names the popup by its id and name, and its creative by what it shows', async () => {
    const image = await popup();
    exitIntent(image.engine, { id: 'summer', name: 'Summer sale', image: IMAGE });
    leave();
    expect(image.seen[0]).toEqual([
      'promotion.viewed',
      { id: 'summer', type: 'exit_intent', name: 'Summer sale', creative: IMAGE },
    ]);

    const template = await popup(TEMPLATE);
    exitIntent(template.engine, { template: 'exit-offer', image: IMAGE });
    leave();
    expect(template.seen[0]).toEqual([
      'promotion.viewed',
      { id: 'exit_intent', type: 'exit_intent', creative: 'exit-offer' },
    ]);

    const fallback = await popup();
    exitIntent(fallback.engine, { template: 'missing', image: IMAGE });
    leave();
    expect(fallback.seen[0]![1]).toMatchObject({ creative: IMAGE });
  });

  it('sends promotion.clicked and closes as clicked without waiting for the code an apply-coupon button applies', async () => {
    const { engine, seen, names } = await popup(TEMPLATE);
    await engine.cart.addItem(1);
    exitIntent(engine, { template: 'exit-offer' });
    leave();
    click('[data-exit-intent-action="apply-coupon"]');
    await Promise.resolve();
    expect(names()).toEqual(['promotion.viewed', 'promotion.clicked', 'promotion.closed']);
    expect(document.querySelector('.exit-intent-popup')).toBeNull();
    await vi.waitFor(() => expect(names()).toContain('coupon.applied'));
    expect(seen[1]![1]).toEqual({
      id: 'exit_intent',
      type: 'exit_intent',
      creative: 'exit-offer',
      action: 'apply-coupon',
      coupon_code: 'SAVE10',
    });
    expect(seen[2]![1]).toMatchObject({ id: 'exit_intent', reason: 'clicked' });
  });

  it('closes at once when an apply-coupon button is clicked with an empty cart', async () => {
    const { engine, seen, names } = await popup(TEMPLATE);
    exitIntent(engine, { template: 'exit-offer' });
    leave();
    click('[data-exit-intent-action="apply-coupon"]');
    await flush();
    expect(names()).toEqual(['promotion.viewed', 'promotion.clicked', 'promotion.closed']);
    expect(seen[2]![1]).toMatchObject({ reason: 'clicked' });
    expect(document.querySelector('.exit-intent-popup')).toBeNull();
  });

  it('sends promotion.clicked before a custom or image action runs, and closes once it has run', async () => {
    for (const [html, options, target] of [
      [TEMPLATE, { template: 'exit-offer' }, '[data-exit-intent-action="custom"]'],
      ['', { image: IMAGE }, '.exit-intent-popup img'],
    ] as const) {
      const { engine, names } = await popup(html);
      let finish!: () => void;
      const before: string[][] = [];
      const action = () => {
        before.push(names());
        return new Promise<void>((resolve) => (finish = resolve));
      };
      exitIntent(engine, { ...options, action });
      leave();
      click(target);
      expect(before).toEqual([['promotion.viewed', 'promotion.clicked']]);
      expect(document.querySelector('.exit-intent-popup')).not.toBeNull();
      finish();
      await flush();
      expect(names()).toEqual(['promotion.viewed', 'promotion.clicked', 'promotion.closed']);
      expect(document.querySelector('.exit-intent-popup')).toBeNull();
    }
  });

  it('ends each view in one promotion.closed: dismissed, close_button or clicked', async () => {
    const { engine, seen } = await popup();
    const stop = exitIntent(engine, { image: IMAGE, showCloseButton: true, maxTriggers: 5 });
    const closes = () =>
      seen.filter(([name]) => name === 'promotion.closed').map(([, data]) => (data as { reason: string }).reason);

    leave();
    escape();
    leave();
    click('.exit-intent-overlay');
    leave();
    click('.exit-intent-close');
    leave();
    click('.exit-intent-popup img');
    click('.exit-intent-popup img');
    await flush();
    leave();
    stop();

    expect(closes()).toEqual(['dismissed', 'dismissed', 'close_button', 'clicked', 'dismissed']);
    expect(seen.filter(([name]) => name === 'promotion.viewed')).toHaveLength(5);
    expect(seen.filter(([name]) => name === 'promotion.clicked')).toHaveLength(1);
  });

  it('leaves the next popup open when an earlier one is closed before its action finishes', async () => {
    const { engine, names } = await popup();
    let finish!: () => void;
    exitIntent(engine, { image: IMAGE, maxTriggers: 2, action: () => new Promise<void>((r) => (finish = r)) });
    leave();
    click('.exit-intent-popup img');
    escape();
    leave();
    finish();
    await flush();
    expect(document.querySelector('.exit-intent-popup')).not.toBeNull();
    expect(names()).toEqual(['promotion.viewed', 'promotion.clicked', 'promotion.closed', 'promotion.viewed']);
  });

  it('closes as clicked and logs the error when the action throws', async () => {
    const { engine, seen } = await popup();
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const failure = new Error('page script');
    exitIntent(engine, { image: IMAGE, action: () => Promise.reject(failure) });
    leave();
    click('.exit-intent-popup img');
    await flush();
    expect(seen.at(-1)).toEqual(['promotion.closed', expect.objectContaining({ reason: 'clicked' })]);
    expect(engine.log.entries()).toContainEqual(
      expect.objectContaining({ level: 'error', message: 'exitIntent action failed', data: failure }),
    );
  });

  it('logs the error when applying the code of an apply-coupon button fails', async () => {
    const { engine, names } = await popup(TEMPLATE);
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const failure = new Error('network');
    vi.spyOn(engine.cart, 'applyCoupon').mockRejectedValue(failure);
    exitIntent(engine, { template: 'exit-offer' });
    leave();
    click('[data-exit-intent-action="apply-coupon"]');
    await flush();
    expect(names()).toEqual(['promotion.viewed', 'promotion.clicked', 'promotion.closed']);
    expect(engine.log.entries()).toContainEqual(
      expect.objectContaining({ level: 'error', message: 'exitIntent action failed', data: failure }),
    );
  });

  it('opens on a touch screen when the shopper scrolls back up, with mobileScrollTrigger', async () => {
    vi.stubGlobal('matchMedia', () => ({ matches: true }));
    const { engine, names } = await popup();
    exitIntent(engine, { image: IMAGE, mobileScrollTrigger: true });
    leave();
    expect(names()).toEqual([]);
    const scrollTo = (y: number) => {
      vi.stubGlobal('scrollY', y);
      dispatchEvent(new Event('scroll'));
    };
    scrollTo(innerHeight);
    scrollTo(innerHeight - 101);
    expect(names()).toEqual(['promotion.viewed']);
  });
});
