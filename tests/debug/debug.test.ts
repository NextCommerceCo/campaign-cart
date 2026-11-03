import { afterEach, describe, expect, it, vi } from 'vitest';
import { boot } from '../../src/boot';
import { ANALYTICS_CSS, CART_CSS, PANEL_CSS, TSUGI_CSS } from '../../src/debug/styles';
import { fakeApi } from '../fixtures/api';
import { campaign } from '../fixtures/campaign';

const shadow = () => document.querySelector('next-debug')!.shadowRoot!;
const $ = <E extends HTMLElement = HTMLElement>(selector: string) => shadow().querySelector<E>(selector)!;
const view = () => $('.root').dataset.view;
const body = () => $('.body').textContent!;
const tab = (name: string) => $(`[data-tab="${name}"]`).click();
const menuItem = (label: string) =>
  [...shadow().querySelectorAll<HTMLElement>('.menu button')].find((b) => b.firstChild!.textContent === label)!;
const details = (key: string) =>
  [...shadow().querySelectorAll<HTMLDetailsElement>('.body > details')].find((d) => d.textContent!.startsWith(key))!;

async function start(markup = '') {
  document.body.innerHTML = markup;
  vi.stubGlobal('fetch', fakeApi().fetch);
  for (const level of ['debug', 'info', 'warn'] as const) vi.spyOn(console, level).mockImplementation(() => {});
  const next = boot(
    { apiKey: 'pk_test', apiBase: 'https://api.test', funnel: 'f1', debug: true, reset: false },
    Promise.resolve(campaign),
  );
  await vi.waitFor(() => expect(document.querySelector('next-debug')).not.toBeNull());
  return next;
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  document.body.innerHTML = '';
});

describe('debug tools', () => {
  it('opens a menu from the floating button with the cart, campaign and setup, and closes on an outside click', async () => {
    const next = await start();
    await next.actions.addItem(1);
    $('.fab').click();
    expect(view()).toBe('menu');
    const menu = $('.menu').textContent!;
    expect(menu).toMatch(/Cart1 item · \$[\d.]+/);
    expect(menu).toContain('CampaignOlympus · USD');
    expect(menu).toContain('APIapi.test');
    expect(menu).toContain('Funnelf1');
    document.body.click();
    expect(view()).toBe('closed');
  });

  it('opens each panel tab from the menu, and closes on Esc', async () => {
    const next = await start();
    await next.actions.addItem(1);
    $('.fab').click();
    menuItem('Analytics').click();
    expect(view()).toBe('panel');
    expect($('[data-tab="analytics"]').getAttribute('aria-selected')).toBe('true');
    expect(body()).toContain('GA4 events sent');
    expect(body()).toContain('All workflows');
    tab('logs');
    expect(body()).toContain('infostorage scope');
    expect(body()).toMatch(/debugapi POST \/api\/v1\/carts\/calculate\/ → 200 in \d+ ms/);
    tab('state');
    expect(details('cart').open).toBe(true);
    expect(details('cart').textContent).toContain('groups');
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(view()).toBe('closed');
  });

  it('keeps expanded nodes open when the state changes', async () => {
    const next = await start();
    $('.fab').click();
    menuItem('Cart').click();
    tab('state');
    details('visit').open = true;
    await vi.waitFor(() => expect(details('visit').textContent).toContain('params'));
    await next.actions.addItem(1);
    await vi.waitFor(() => expect(details('cart').textContent).toContain('summary'));
    expect(details('visit').open).toBe(true);
    expect(details('campaign').open).toBe(false);
  });

  it('filters the logs', async () => {
    const next = await start('<span data-next-display="cart.nope"></span>');
    await next.actions.addItem(1);
    $('.fab').click();
    menuItem('Logs').click();
    const filter = $<HTMLInputElement>('input');
    filter.value = 'unknown display';
    filter.dispatchEvent(new Event('input'));
    expect(body()).toContain('warnunknown display path "cart.nope"');
    expect(body()).not.toContain('api POST');
  });

  it('counts issues on the button and lists each once, with the element behind it', async () => {
    const next = await start('<span data-next-display="cart.nope"></span><button data-next-package-id="999"></button>');
    await next.actions.addItem(1);
    next.on('fomo:shown' as never, () => {});
    await vi.waitFor(() => expect($('.issues').textContent).toBe('3 Issues'));
    expect($('.issues').classList.contains('amber')).toBe(true);
    $('.fab').click();
    menuItem('Issues').click();
    expect(body()).toContain('Page setup · 2');
    expect(body()).toContain('data-next-display="cart.nope" → unknown path');
    expect(body()).toContain('data-next-package-id="999" → not in this campaign');
    expect(body()).toContain('Warnings and errors · 1');
    expect(body()).toContain('next.on: unknown event "fomo:shown"');
    expect(body()).not.toContain('unknown display path');
  });

  it('says there are no issues on a clean page', async () => {
    await start('<span data-next-display="campaign.name"></span>');
    $('.fab').click();
    menuItem('Issues').click();
    expect(body()).toContain('No issues');
    expect($('.issues').textContent).toBe('');
  });

  it('shows the real analytics runs, and walks one from trigger to delivery', async () => {
    const next = await start('<button data-next-package-id="1">Buy</button>');
    const layer = () => (window as unknown as { NextDataLayer?: Array<{ event: string }> }).NextDataLayer ?? [];
    await vi.waitFor(() => expect(layer().map((e) => e.event)).toContain('dl_view_item'));
    await next.actions.addItem(1);
    await vi.waitFor(() => expect(layer().map((e) => e.event)).toContain('dl_add_to_cart'));
    $('.fab').click();
    menuItem('Analytics').click();
    const sent = [
      ...new Set([...shadow().querySelectorAll('.run.ok code, .run.warn code')].map((c) => c.textContent)),
    ].sort();
    expect(sent).toEqual(['add_to_cart', 'page_view', 'update_cart', 'view_item']);
    [...shadow().querySelectorAll<HTMLElement>('.run')].find((r) => r.textContent!.startsWith('✓add_to_cart'))!.click();
    const steps = [...shadow().querySelectorAll('.step')].map((s) => s.querySelector('.stitle')!.textContent);
    expect(steps).toEqual(['Triggercart.calculated', 'Decide', 'Buildadd_to_cart', 'Pushdl_add_to_cart', 'Deliver']);
    expect(shadow().querySelectorAll('.step .sdetail')[1]!.textContent).toBe(
      'Send: Added since the last report: Earbuds ×1 ×1',
    );
  });

  it('lists every SDK element with what it resolves to', async () => {
    const next = await start(
      '<p data-next-show="cart.total"><span data-next-display="cart.total"></span></p><span data-next-display="cart.nope"></span>',
    );
    await next.actions.addItem(1);
    $('.fab').click();
    menuItem('Elements').click();
    expect(body()).toContain('3 elements · 1 with problems');
    expect(body()).toMatch(/data-next-display="cart.total" → "\$[\d.]+"/);
  });

  it('picks an element on the page without clicking it, and shows it with its SDK parents', async () => {
    await start(
      '<div data-next-bundle-selector><button data-next-package-id="1"><b>Buy</b></button></div><p data-next-show="cart.total">x</p>',
    );
    const clicked = vi.fn();
    document.querySelector('button')!.addEventListener('click', clicked);
    $('.fab').click();
    menuItem('Pick an element').click();
    expect($('.root').classList.contains('picking')).toBe(true);
    document.querySelector('b')!.click();
    expect(clicked).not.toHaveBeenCalled();
    expect($('.root').classList.contains('picking')).toBe(false);
    expect(view()).toBe('panel');
    expect($('[data-tab="elements"]').getAttribute('aria-selected')).toBe('true');
    expect(body()).toContain('Picked element and its SDK parents');
    expect(body()).toContain('data-next-package-id="1" → Earbuds ×1 · 49.00');
    expect(body()).toContain('data-next-bundle-selector');
    expect(body()).not.toContain('data-next-show');
    $('.link').click();
    expect(body()).toContain('data-next-show');
    document.querySelector('b')!.click();
    expect(clicked).toHaveBeenCalledOnce();
  });

  it('stops picking on Esc and keeps the page clickable', async () => {
    await start('<button data-next-package-id="1">Buy</button>');
    $('.fab').click();
    menuItem('Elements').click();
    $('[aria-label="Pick an element"]').click();
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect($('.root').classList.contains('picking')).toBe(false);
    expect(view()).toBe('panel');
    const clicked = vi.fn();
    document.querySelector('button')!.addEventListener('click', clicked);
    document.querySelector('button')!.click();
    expect(clicked).toHaveBeenCalledOnce();
  });

  it('moves to the right side', async () => {
    await start();
    $('.fab').click();
    menuItem('Position').click();
    expect($('.root').classList.contains('right')).toBe(true);
    expect(menuItem('Position').textContent).toBe('PositionRight');
  });

  it('styles the panel, the analytics view and the cart view with separate class names', async () => {
    await start();
    expect(shadow().querySelector('style')!.textContent).toBe(TSUGI_CSS + PANEL_CSS + ANALYTICS_CSS + CART_CSS);
    const classes = (css: string) => new Set([...css.matchAll(/(?:^|[},])\s*\.([a-z][\w-]*)/gm)].map((m) => m[1]));
    const panel = classes(PANEL_CSS);
    const analytics = classes(ANALYTICS_CSS);
    const cart = classes(CART_CSS);
    expect([...analytics].filter((name) => panel.has(name))).toEqual([]);
    expect([...cart].filter((name) => panel.has(name) || analytics.has(name))).toEqual([]);
    const components = ['badge', 'btn', 'card', 'input', 'select'];
    expect([...panel, ...analytics, ...cart].filter((name) => components.includes(name!))).toEqual([]);
  });

  it('draws with the vendored tsugi tokens, light or dark like the system', async () => {
    const dark = vi.spyOn(window, 'matchMedia').mockReturnValue({
      matches: true,
      addEventListener: () => {},
    } as unknown as MediaQueryList);
    await start();
    expect(TSUGI_CSS).toMatch(/^\/\*! tsugi \d+\.\d+\.\d+: /);
    expect(TSUGI_CSS).toContain(':host{');
    expect(TSUGI_CSS).toContain(':host(.dark){');
    expect(TSUGI_CSS).toMatch(/@layer properties\{\*,/);
    expect(TSUGI_CSS).not.toContain('@property');
    expect(CART_CSS).not.toMatch(/#[\da-f]{3,8}\b|rgba?\(|oklch\(/i);
    expect(shadow().host.classList.contains('dark')).toBe(true);
    dark.mockRestore();
  });

  it('explains an element from the console', async () => {
    await start('<span data-next-display="campaign.name"></span>');
    const { nextDebug } = window as unknown as { nextDebug: { explain(el: Element): Record<string, string> } };
    await vi.waitFor(() =>
      expect(nextDebug.explain(document.querySelector('span')!)).toEqual({
        'data-next-display': 'campaign.name → "Olympus"',
      }),
    );
  });
});
