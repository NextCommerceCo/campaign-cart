import { afterEach, describe, expect, it, vi } from 'vitest';
import { boot } from '../../src/boot';
import { fakeApi } from '../fixtures/api';
import { campaign } from '../fixtures/campaign';

const shadow = () => document.querySelector('next-debug')!.shadowRoot!;
const $ = <E extends HTMLElement = HTMLElement>(selector: string) => shadow().querySelector<E>(selector)!;
const body = () => $('.body').textContent!;
const tab = (name: string) => $(`[data-tab="${name}"]`).click();

async function openPanel(markup = '') {
  document.body.innerHTML = markup;
  vi.stubGlobal('fetch', fakeApi().fetch);
  for (const level of ['debug', 'info', 'warn'] as const) vi.spyOn(console, level).mockImplementation(() => {});
  const next = boot(
    { apiKey: 'pk_test', apiBase: 'https://api.test', funnel: 'f1', debug: true, reset: false },
    Promise.resolve(campaign),
  );
  await vi.waitFor(() => expect(document.querySelector('next-debug')).not.toBeNull());
  $('.toggle').click();
  return next;
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  document.body.innerHTML = '';
});

describe('debug panel', () => {
  it('opens with ?debug=1 and shows state, events, logs with each API call, and the setup', async () => {
    const next = await openPanel();
    await next.actions.addItem(1);
    tab('state');
    const cart = [...shadow().querySelectorAll('.body > details')].find((d) => d.textContent!.startsWith('cart'))!;
    (cart as HTMLDetailsElement).open = true;
    await vi.waitFor(() => expect(cart.textContent).toContain('groups'));
    tab('events');
    expect(body()).toContain('cart.updated');
    tab('logs');
    expect(body()).toContain('info  storage scope');
    expect(body()).toContain('debug event cart.updated');
    expect(body()).toMatch(/api POST \/api\/v1\/carts\/calculate\/ → 200 in \d+ ms/);
    tab('setup');
    expect(body()).toContain('f1');
    expect(body()).toContain('Olympus (USD)');
  });

  it('keeps an expanded node open when the state changes', async () => {
    const next = await openPanel();
    const cart = () =>
      [...shadow().querySelectorAll<HTMLDetailsElement>('.body > details')].find((d) =>
        d.textContent!.startsWith('cart'),
      )!;
    cart().open = true;
    await vi.waitFor(() => expect(cart().textContent).toContain('groups'));
    await next.actions.addItem(1);
    await vi.waitFor(() => expect(cart().textContent).toContain('summary'));
    expect(cart().open).toBe(true);
  });

  it('filters logs and counts warnings on the toggle', async () => {
    const next = await openPanel('<span data-next-display="cart.nope"></span>');
    await next.actions.addItem(1);
    tab('logs');
    const filter = $<HTMLInputElement>('input');
    filter.value = 'unknown display';
    filter.dispatchEvent(new Event('input'));
    expect(body()).toContain('warn  unknown display path "cart.nope"');
    expect(body()).not.toContain('api POST');
    await vi.waitFor(() => expect($('.badge').textContent).toBe('1'));
    expect($('.badge').classList.contains('err')).toBe(false);
  });

  it('lists every SDK element with what it resolves to', async () => {
    const next = await openPanel(
      '<p data-next-show="cart.total"><span data-next-display="cart.total"></span></p><span data-next-display="cart.nope"></span>',
    );
    await next.actions.addItem(1);
    tab('elements');
    expect(body()).toContain('3 elements · 1 with problems');
    expect(body()).toMatch(/data-next-display="cart.total" → "\$[\d.]+"/);
    expect(body()).toContain('data-next-display="cart.nope" → unknown path');
  });

  it('picks an element on the page without clicking it, and shows it with its SDK parents', async () => {
    await openPanel(
      '<div data-next-bundle-selector><button data-next-package-id="1"><b>Buy</b></button></div><p data-next-show="cart.total">x</p>',
    );
    const clicked = vi.fn();
    document.querySelector('button')!.addEventListener('click', clicked);
    $('button[title]').click();
    expect($('button[title]').getAttribute('aria-pressed')).toBe('true');
    document.querySelector('b')!.click();
    expect(clicked).not.toHaveBeenCalled();
    expect($('[data-tab="elements"]').getAttribute('aria-pressed')).toBe('true');
    expect(body()).toContain('picked element and its SDK parents');
    expect(body()).toContain('data-next-package-id="1" → Earbuds ×1 · 49.00');
    expect(body()).toContain('data-next-bundle-selector');
    expect(body()).not.toContain('data-next-show');
    [...shadow().querySelectorAll('button')].find((b) => b.textContent === 'show all')!.click();
    expect(body()).toContain('data-next-show');
    document.querySelector('b')!.click();
    expect(clicked).toHaveBeenCalledOnce();
  });

  it('stops picking on Escape', async () => {
    await openPanel('<button data-next-package-id="1">Buy</button>');
    $('button[title]').click();
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect($('button[title]').getAttribute('aria-pressed')).toBe('false');
    const clicked = vi.fn();
    document.querySelector('button')!.addEventListener('click', clicked);
    document.querySelector('button')!.click();
    expect(clicked).toHaveBeenCalledOnce();
  });

  it('explains an element from the console', async () => {
    await openPanel('<span data-next-display="campaign.name"></span>');
    const { nextDebug } = window as unknown as { nextDebug: { explain(el: Element): Record<string, string> } };
    await vi.waitFor(() =>
      expect(nextDebug.explain(document.querySelector('span')!)).toEqual({
        'data-next-display': 'campaign.name → "Olympus"',
      }),
    );
  });
});
