import { afterEach, describe, expect, it, vi } from 'vitest';
import { bindAll } from '../../src/bindings';
import { flush, makeEngine } from '../fixtures/engine';

async function setup(html: string) {
  document.body.innerHTML = html;
  const { engine } = makeEngine();
  await engine.load();
  bindAll(document, engine, vi.fn());
  return {
    engine,
    $: (s: string) => document.querySelector<HTMLElement>(s)!,
    $$: (s: string) => [...document.querySelectorAll<HTMLElement>(s)],
  };
}

afterEach(() => {
  document.body.innerHTML = '';
});

describe('coupon', () => {
  it('applies the typed code on click and on Enter', async () => {
    const { engine, $ } = await setup(
      `<div data-next-coupon="input"><input><button class="next-disabled">Apply</button></div>`,
    );
    const input = $('input') as HTMLInputElement;
    input.value = ' save10 ';
    input.dispatchEvent(new Event('input'));
    expect($('button').classList.contains('next-disabled')).toBe(false);
    $('button').click();
    expect(engine.getState().cart.coupons).toEqual(['SAVE10']);
    input.value = 'welcome';
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
    expect(engine.getState().cart.coupons).toEqual(['SAVE10', 'WELCOME']);
  });
});
