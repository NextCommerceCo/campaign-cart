import { readdirSync, readFileSync } from 'node:fs';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { boot } from '../../src/boot';
import { ANALYTICS_CSS, CART_CSS, CHECKOUT_CSS, JOURNEY_CSS, PANEL_CSS, TSUGI_CSS } from '../../src/debug/styles';
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

async function start(markup = '', config: { debug?: boolean } = { debug: true }) {
  document.body.innerHTML = markup;
  vi.stubGlobal('fetch', fakeApi().fetch);
  for (const level of ['debug', 'info', 'warn'] as const) vi.spyOn(console, level).mockImplementation(() => {});
  const next = boot(
    { apiKey: 'pk_test', apiBase: 'https://api.test', funnel: 'f1', reset: false, ...config },
    Promise.resolve(campaign),
  );
  await vi.waitFor(() => expect(document.querySelector('next-debug')).not.toBeNull());
  return next;
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  document.body.innerHTML = '';
  sessionStorage.clear();
});

describe('debug tools', () => {
  it('opens a menu from the floating button with the cart, campaign and setup, and closes on an outside click', async () => {
    const next = await start();
    await next.actions.addItem(1);
    $('.fab').click();
    expect(view()).toBe('menu');
    const menu = $('.menu').textContent!;
    expect(menu).toMatch(/Checkout1 item · \$[\d.]+ · cart only/);
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
    expect(body()).toContain('Tracking');
    expect(body()).toContain('On this page');
    tab('logs');
    expect(body()).toContain('info storage scope');
    expect(body()).toMatch(/debug api POST \/api\/v1\/carts\/calculate\/ → 200 in \d+ ms/);
    tab('state');
    expect(details('cart').open).toBe(true);
    expect(details('cart').textContent).toContain('groups');
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(view()).toBe('closed');
  });

  it('follows the shopper to the next page of the tab, open where it was left, until ?debug=0', async () => {
    await start();
    $('.fab').click();
    menuItem('Checkout').click();
    await start('', {});
    expect(view()).toBe('panel');
    expect($('[data-tab="checkout"]').getAttribute('aria-selected')).toBe('true');
    tab('journey');
    expect(shadow().querySelectorAll('.journey > ol > li')).toHaveLength(2);
    $('[aria-label="Close"]').click();
    $('.fab').click();
    expect(menuItem('Journey').textContent).toBe('Journey2 pages in this tab');
    expect(menuItem('Turn off debug')).toBeDefined();
    document.body.innerHTML = '';
    boot(
      { apiKey: 'pk_test', apiBase: 'https://api.test', funnel: 'f1', debug: false, reset: false },
      Promise.resolve(campaign),
    );
    await new Promise((r) => setTimeout(r, 20));
    expect(document.querySelector('next-debug')).toBeNull();
  });

  it('switches tabs from a select when the panel is too narrow for the tab row', async () => {
    await start('<span data-next-display="cart.nope"></span>');
    $('.fab').click();
    menuItem('Checkout').click();
    const pick = $<HTMLSelectElement>('select.tabpick');
    expect([pick.value, pick.options[1]!.text]).toEqual(['checkout', 'Issues · 1']);
    pick.value = 'logs';
    pick.dispatchEvent(new Event('change'));
    expect($('[data-tab="logs"]').getAttribute('aria-selected')).toBe('true');
    expect(PANEL_CSS).toContain('@container panel (max-width:560px){.head .tabs{display:none}.tabpick{display:block}}');
    expect(ANALYTICS_CSS).not.toContain('@media');
  });

  it('keeps the panel open on Esc while the product picker is open', async () => {
    await start();
    $('.fab').click();
    menuItem('Checkout').click();
    [...shadow().querySelectorAll<HTMLElement>('.body button')].find((b) => b.textContent === 'Add packages')!.click();
    expect($<HTMLDialogElement>('dialog.picker').open).toBe(true);
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(view()).toBe('panel');
  });

  it('keeps expanded nodes open when the state changes', async () => {
    const next = await start();
    $('.fab').click();
    menuItem('Checkout').click();
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
    expect(body()).toContain('warn unknown display path "cart.nope"');
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

  it('lists what the journey, checkout and analytics found on this page, and opens the tab behind each', async () => {
    const next = await start('<span data-next-display="campaign.name"></span>');
    await next.actions.addItem(1);
    await next.actions.applyCoupon('NOPE');
    await vi.waitFor(() => expect($('.issues').textContent).toBe('1 Issue'));
    $('.fab').click();
    expect(menuItem('Issues').textContent).toBe('Issues1');
    menuItem('Issues').click();
    expect(body()).toContain('Problems · 1');
    const row = [...shadow().querySelectorAll<HTMLElement>('.body .ecard')].find((c) =>
      c.textContent!.includes('refused'),
    )!;
    expect(row.textContent).toBe('Journey Coupon NOPE refused by the server');
    row.click();
    expect($('[data-tab="journey"]').getAttribute('aria-selected')).toBe('true');
    await start('<span data-next-display="campaign.name"></span>', {});
    tab('issues');
    expect(body()).toContain('No issues');
    expect(body()).toContain('Earlier pages in this tab had 1 problem.');
  });

  it('keeps a filter to its own tab, and opens each tab at the top', async () => {
    await start('<span data-next-display="campaign.name"></span>');
    $('.fab').click();
    menuItem('Logs').click();
    const filter = $<HTMLInputElement>('.search input');
    filter.value = 'api';
    filter.dispatchEvent(new Event('input'));
    $('.body').scrollTop = 120;
    tab('elements');
    expect(filter.value).toBe('');
    expect($('.body').scrollTop).toBe(0);
    expect(body()).toContain('data-next-display="campaign.name"');
    tab('logs');
    expect(filter.value).toBe('api');
  });

  it('names one page, says when a page has no SDK elements, and asks before clearing saved data', async () => {
    await start();
    const assign = vi.spyOn(location, 'assign').mockImplementation(() => {});
    $('.fab').click();
    expect(menuItem('Journey').textContent).toBe('Journey1 page in this tab');
    expect(menuItem('Reset saved data').textContent).toBe("Reset saved datathis funnel's cart, form and order");
    menuItem('Reset saved data').click();
    expect(assign).not.toHaveBeenCalled();
    await vi.waitFor(() =>
      expect(menuItem('Reset saved data').textContent).toBe(
        "Reset saved dataclick again to clear this funnel's cart, form and order",
      ),
    );
    expect(view()).toBe('menu');
    menuItem('Reset saved data').click();
    expect(assign).toHaveBeenCalledWith(expect.stringMatching(/\?reset=1$/));
    menuItem('Elements').click();
    expect(body()).toContain('No element on this page has a data-next-* attribute.');
  });

  it('says there are no issues on a clean page', async () => {
    await start('<span data-next-display="campaign.name"></span>');
    $('.fab').click();
    menuItem('Issues').click();
    expect(body()).toContain('No issues');
    expect($('.issues').textContent).toBe('');
  });

  it('shows the real analytics events, and opens one for why it was sent', async () => {
    const next = await start('<button data-next-package-id="1">Buy</button>');
    const layer = () => (window as unknown as { NextDataLayer?: Array<{ event: string }> }).NextDataLayer ?? [];
    await vi.waitFor(() => expect(layer().map((e) => e.event)).toContain('dl_view_item'));
    await next.actions.addItem(1);
    await vi.waitFor(() => expect(layer().map((e) => e.event)).toContain('dl_add_to_cart'));
    $('.fab').click();
    menuItem('Analytics').click();
    const sent = [
      ...new Set([...shadow().querySelectorAll('.arun.ok code, .arun.warn code')].map((c) => c.textContent)),
    ];
    expect(sent.sort()).toEqual(['add_to_cart', 'page_view', 'update_cart', 'view_item']);
    [...shadow().querySelectorAll<HTMLElement>('.arun')]
      .find((r) => r.querySelector('code')!.textContent === 'add_to_cart')!
      .click();
    expect(shadow().querySelector('.aevent .adetail dd')!.textContent).toBe(
      'Added since the last report: Earbuds ×1 ×1Cart priced: cart.calculated',
    );
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(view()).toBe('panel');
    [...shadow().querySelectorAll<HTMLElement>('.arun')]
      .find((r) => r.querySelector('code')!.textContent === 'update_cart')!
      .click();
    const detail = [...shadow().querySelectorAll('.aevent .adetail > dt')].map((dt) => [
      dt.textContent,
      dt.nextElementSibling!.textContent,
    ]);
    expect(Object.fromEntries(detail)['Adds up']).toMatch(/^✓ value \$[\d.]+ = the cart lines \$[\d.]+$/);
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

  it('styles the panel and each view with separate class names, never restyling a tsugi component', async () => {
    await start();
    expect(shadow().querySelector('style')!.textContent).toBe(
      TSUGI_CSS + PANEL_CSS + ANALYTICS_CSS + CART_CSS + CHECKOUT_CSS + JOURNEY_CSS,
    );
    const classes = (css: string) => new Set([...css.matchAll(/(?:^|[},])\s*\.([a-z][\w-]*)/gm)].map((m) => m[1]));
    const panel = classes(PANEL_CSS);
    const analytics = classes(ANALYTICS_CSS);
    const cart = classes(CART_CSS);
    const journey = classes(JOURNEY_CSS);
    const checkout = classes(CHECKOUT_CSS);
    expect([...analytics].filter((name) => panel.has(name))).toEqual([]);
    expect([...cart].filter((name) => panel.has(name) || analytics.has(name))).toEqual([]);
    expect([...journey].filter((name) => panel.has(name) || analytics.has(name) || cart.has(name))).toEqual([]);
    expect(
      [...checkout].filter((name) => panel.has(name) || analytics.has(name) || cart.has(name) || journey.has(name)),
    ).toEqual([]);
    const rules = [
      ...(PANEL_CSS + ANALYTICS_CSS + CART_CSS + CHECKOUT_CSS + JOURNEY_CSS).matchAll(/^\.([a-z][\w-]*)\{/gm),
    ];
    const counts = rules.reduce<Record<string, number>>((n, [, name]) => ({ ...n, [name!]: (n[name!] ?? 0) + 1 }), {});
    expect(Object.entries(counts).filter(([, n]) => n > 1)).toEqual([]);
    const code = readdirSync('src/debug')
      .filter((file) => file !== 'styles.ts')
      .map((file) => readFileSync(`src/debug/${file}`, 'utf8'))
      .join('\n');
    const unused = (names: Set<string | undefined>) =>
      [...names].filter((name) => !new RegExp(`(?<![\\w-])${name}(?![\\w-])`).test(code));
    expect([panel, analytics, cart, journey, checkout].flatMap(unused)).toEqual([]);
    const vendored = readFileSync('scripts/tsugi.mjs', 'utf8').match(/const COMPONENTS = \[([^\]]*)\]/)![1]!;
    const CLASSES: Record<string, string> = { button: 'btn', 'native-select': 'select', scrollbar: 'scrollbar-sm' };
    expect(unused(new Set([...vendored.matchAll(/'([\w-]+)'/g)].map(([, name]) => CLASSES[name!] ?? name)))).toEqual(
      [],
    );
    const components = ['badge', 'btn', 'card', 'empty', 'input', 'journey', 'select', 'stat', 'tabs', 'timeline'];
    expect(
      [...panel, ...analytics, ...cart, ...journey, ...checkout].filter((name) => components.includes(name!)),
    ).toEqual([]);
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
    const defined = (css: string) => new Set([...css.matchAll(/(--[\w-]+):/g)].map((m) => m[1]));
    const tokens = defined(TSUGI_CSS);
    const ours = PANEL_CSS + ANALYTICS_CSS + CART_CSS + CHECKOUT_CSS + JOURNEY_CSS;
    expect([...defined(ours)].filter((name) => tokens.has(name))).toEqual([]);
    expect(PANEL_CSS).toMatch(/\.link\{[^}]*\}\s*\.link\.danger\{color:var\(--destructive\)\}/);
    expect(ANALYTICS_CSS + CART_CSS + CHECKOUT_CSS + JOURNEY_CSS).not.toMatch(/#[\da-f]{3,8}\b|rgba?\(|oklch\(/i);
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
