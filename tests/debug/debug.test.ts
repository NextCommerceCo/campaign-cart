import { readdirSync, readFileSync } from 'node:fs';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { boot } from '../../src/boot';
import {
  ANALYTICS_CSS,
  CART_CSS,
  CHECKOUT_CSS,
  CONFIG_CSS,
  JOURNEY_CSS,
  LOCALE_CSS,
  PANEL_CSS,
  TSUGI_CSS,
} from '../../src/debug/styles';
import type { Campaign } from '../../src/engine/types';
import { fakeApi } from '../fixtures/api';
import { campaign } from '../fixtures/campaign';

const shadow = () => document.querySelector('next-debug')!.shadowRoot!;
const $ = <E extends HTMLElement = HTMLElement>(selector: string) => shadow().querySelector<E>(selector)!;
const view = () => $('.root').dataset.view;
const body = () => $('.body').textContent!;
const tab = (name: string) => $(`[data-tab="${name}"]`).click();
const menuItem = (label: string) =>
  [
    ...shadow().querySelectorAll<HTMLElement>(
      '.menu :is([role=menuitem], [role=menuitemcheckbox], [role=menuitemradio])',
    ),
  ].find((b) => b.querySelector(':scope > span:not(.icon):not(.mval)')?.firstChild?.textContent === label)!;
const settings = () => {
  while (view() !== 'menu') $('.fab').click();
  if (!shadow().querySelector('.mtop')) $('.mhead [aria-label="Settings"]').click();
};
const back = () => $('.mtop [aria-label="Back"]').click();
const developer = async () => {
  settings();
  menuItem('Developer mode').click();
  await vi.waitFor(() => expect(menuItem('Developer mode').getAttribute('aria-checked')).toBe('true'));
  back();
};
const details = (key: string) =>
  [...shadow().querySelectorAll<HTMLDetailsElement>('.body > details')].find((d) => d.textContent!.startsWith(key))!;

async function start(
  markup = '',
  config: { debug?: boolean } = { debug: true },
  {
    page = campaign,
    fetch = fakeApi().fetch,
    boot: run = boot,
  }: { page?: Campaign; fetch?: typeof globalThis.fetch; boot?: typeof boot } = {},
) {
  document.body.innerHTML = markup;
  vi.stubGlobal('fetch', fetch);
  for (const level of ['debug', 'info', 'warn'] as const) vi.spyOn(console, level).mockImplementation(() => {});
  const next = run(
    { apiKey: 'pk_test', apiBase: 'https://api.test', funnel: 'f1', reset: false, ...config },
    Promise.resolve(page),
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
  it('opens a menu from the floating button with the cart and campaign, and closes on an outside click', async () => {
    const next = await start();
    await next.actions.addItem(1);
    $('.fab').click();
    expect(view()).toBe('menu');
    const menu = $('.menu').textContent!;
    expect(menu).toMatch(/Checkout1 item · \$[\d.]+ · cart only/);
    expect($('.mhead').textContent).toMatch(/^OlympusUSD · SDK v/);
    expect($('.mhead button').getAttribute('aria-label')).toBe('Settings');
    expect(menu).not.toContain('Developer mode');
    expect(menu).not.toContain('Theme');
    expect(menu).not.toContain('APIapi.test');
    expect($('.menu').classList.contains('dropdown')).toBe(true);
    expect(menuItem('Checkout').getAttribute('role')).toBe('menuitem');
    expect(menuItem('Checkout').querySelector('.mval')!.textContent).toMatch(/^1 item · \$[\d.]+ · cart only$/);
    document.body.click();
    expect(view()).toBe('closed');
  });

  it('keeps settings behind the gear, with the setup only in developer mode, and Back returns to the menu', async () => {
    await start();
    settings();
    expect($('.mtop').textContent).toBe('Settings');
    expect(shadow().querySelector('.mhead')).toBeNull();
    expect(menuItem('Developer mode').getAttribute('role')).toBe('menuitemcheckbox');
    expect(menuItem('Developer mode').getAttribute('aria-checked')).toBe('false');
    expect([...shadow().querySelectorAll('.menu [role=group]')].map((g) => g.getAttribute('aria-label'))).toEqual([
      'Theme',
      'Position',
    ]);
    expect($('.menu').textContent).not.toContain('APIapi.test');
    menuItem('Developer mode').click();
    await vi.waitFor(() => expect($('.menu').textContent).toContain('APIapi.test'));
    expect($('.menu').textContent).toContain('Funnelf1');
    back();
    expect(view()).toBe('menu');
    expect($('.mhead').textContent).toMatch(/^Olympus/);
    expect(menuItem('Logs')).toBeDefined();
  });

  it('opens the menu on its main view after closing it from settings', async () => {
    await start();
    settings();
    document.body.click();
    expect(view()).toBe('closed');
    $('.fab').click();
    expect(shadow().querySelector('.mtop')).toBeNull();
    expect($('.mhead [aria-label="Settings"]')).not.toBeNull();
  });

  it('shows the locale in use and opens the Locale tab from the menu', async () => {
    await start();
    $('.fab').click();
    expect(menuItem('Locale').textContent).toMatch(/^LocaleUSD · en$|^Locale\w\w · USD · en$/);
    menuItem('Locale').click();
    expect(view()).toBe('panel');
    expect($('[data-tab="locale"]').getAttribute('aria-selected')).toBe('true');
  });

  it('keeps the menu inside the viewport and the tab strip from running under the panel icons', () => {
    expect(PANEL_CSS).toMatch(/\.menu\{[^}]*max-height:calc\(100vh - 92px\)[^}]*overflow:hidden auto/);
    expect(PANEL_CSS).toMatch(/\.head \.tabs\{[^}]*overflow-x:auto/);
  });

  it('starts simple, with the developer tabs and setup behind Developer mode, remembered on the next page', async () => {
    await start('<span data-next-display="campaign.name"></span>');
    $('.fab').click();
    menuItem('Checkout').click();
    const shown = () =>
      [...shadow().querySelectorAll<HTMLElement>('[role=tab][data-tab]')]
        .filter((t) => !t.hidden)
        .map((t) => t.dataset.tab);
    const pickable = () =>
      [...$<HTMLSelectElement>('select.tabpick').options].filter((o) => !o.disabled).map((o) => o.value);
    expect(shown()).toEqual(['journey', 'issues', 'checkout', 'analytics', 'locale', 'events']);
    expect(pickable()).toEqual(['journey', 'issues', 'checkout', 'analytics', 'locale', 'events']);
    expect($('[aria-label="Pick an element"]').hidden).toBe(true);
    expect($('.root').classList.contains('dev')).toBe(false);
    expect(PANEL_CSS).toContain('.root:not(.dev) .devonly{display:none}');
    await developer();
    menuItem('Logs').click();
    expect(shown()).toEqual([
      'journey',
      'issues',
      'checkout',
      'analytics',
      'locale',
      'events',
      'elements',
      'state',
      'logs',
    ]);
    expect($('[aria-label="Pick an element"]').hidden).toBe(false);
    await start('', {});
    expect($('.root').classList.contains('dev')).toBe(true);
    expect($('[data-tab="logs"]').getAttribute('aria-selected')).toBe('true');
    settings();
    menuItem('Developer mode').click();
    await vi.waitFor(() => expect($('.root').classList.contains('dev')).toBe(false));
    back();
    menuItem('Journey').click();
    expect(shown()).toEqual(['journey', 'issues', 'checkout', 'analytics', 'locale', 'events']);
  });

  it('opens each panel tab from the menu, and closes on Esc', async () => {
    const next = await start();
    await next.actions.addItem(1);
    await developer();
    menuItem('Analytics').click();
    expect(view()).toBe('panel');
    expect($('[data-tab="analytics"]').getAttribute('aria-selected')).toBe('true');
    expect(body()).toMatch(/\d+ events? sent on this page, newest first/);
    tab('logs');
    expect(body()).toContain('storage scope');
    expect(body()).toMatch(/api POST \/api\/v1\/carts\/calculate\/ → 200 in \d+ ms/);
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
    await developer();
    menuItem('Checkout').click();
    const pick = $<HTMLSelectElement>('select.tabpick');
    expect([pick.value, pick.options[1]!.text]).toEqual(['checkout', 'Issues · 1']);
    pick.value = 'logs';
    pick.dispatchEvent(new Event('change'));
    expect($('[data-tab="logs"]').getAttribute('aria-selected')).toBe('true');
    expect(PANEL_CSS).toContain('@container panel (max-width:560px){.head .tabs{display:none}.tabpick{display:block}}');
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
    await developer();
    menuItem('Checkout').click();
    tab('state');
    details('visit').open = true;
    await vi.waitFor(() => expect(details('visit').textContent).toContain('params'));
    await next.actions.addItem(1);
    await vi.waitFor(() => expect(details('cart').textContent).toContain('summary'));
    expect(details('visit').open).toBe(true);
    expect(details('campaign').open).toBe(false);
  });

  it('lists the public events newest first with what each carried, groups them by action on request, and keeps them out of the logs', async () => {
    const next = await start();
    const got: unknown[] = [];
    next.on('cart.added', (_data, event) => got.push(event));
    await new Promise((ready) => next.on('ready', ready));
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(Date.now() + 5000);
    await next.actions.addItem(1);
    vi.useRealTimers();
    await developer();
    menuItem('Events').click();
    const rows = () => [...shadow().querySelectorAll<HTMLDetailsElement>('.body > details')];
    const name = (d: HTMLDetailsElement) => d.querySelector('summary')!.textContent!.match(/\d([a-z]+\.[a-z]+)/)![1];
    await vi.waitFor(() => expect(rows().map(name)).toContain('cart.added'));
    expect(body()).toMatch(/\d+ events on this page, newest first/);
    expect(body()).not.toContain('campaign.loaded');
    expect(shadow().querySelector('.egroup')).toBeNull();
    expect(rows().map(name).indexOf('cart.calculated')).toBeLessThan(rows().map(name).indexOf('sdk.ready'));
    const added = rows().find((d) => name(d) === 'cart.added')!;
    expect(added.querySelector('summary')!.textContent).toMatch(/^[\d:.]+cart\.added .+ 0→1$/);
    expect(body()).not.toContain('{event_id');
    added.open = true;
    const { event_id, session_id } = got[0] as { event_id: string; session_id: string };
    expect(added.textContent).toContain(event_id);
    expect(added.textContent).toContain(session_id);
    expect(added.textContent).toContain('object "cart"');
    const filter = $<HTMLInputElement>('input');
    filter.value = 'Cart.Add';
    filter.dispatchEvent(new Event('input'));
    expect(rows().map(name)).toEqual(['cart.added']);
    filter.value = '0→1';
    filter.dispatchEvent(new Event('input'));
    expect(rows().map(name)).toEqual(['cart.added']);
    filter.value = '';
    filter.dispatchEvent(new Event('input'));
    const chip = (label: string) =>
      [...shadow().querySelectorAll<HTMLButtonElement>('.echips button')].find((b) =>
        b.textContent!.startsWith(label),
      )!;
    expect(chip('All').getAttribute('aria-pressed')).toBe('true');
    expect(chip('cart').querySelector('.edot')!.getAttribute('data-kind')).toBe('cart');
    chip('sdk').click();
    expect(rows().map(name)).toEqual(['sdk.ready']);
    expect(chip('sdk').getAttribute('aria-pressed')).toBe('true');
    chip('All').click();

    expect(chip('Group by action').getAttribute('aria-pressed')).toBe('false');
    chip('Group by action').click();
    expect(chip('Group by action').getAttribute('aria-pressed')).toBe('true');
    expect(Object.values(sessionStorage).some((v) => v.includes('"grouped":true'))).toBe(true);
    expect(body()).toMatch(/\d+ events on this page in 2 groups, newest first/);
    const [newest, older] = rows() as [HTMLDetailsElement, HTMLDetailsElement];
    expect(rows()).toHaveLength(2);
    expect([newest.classList.contains('egroup'), newest.open, older.open]).toEqual([true, true, false]);
    expect(older.querySelector('summary')!.textContent).toContain('sdk.ready');
    const inside = [...newest.querySelectorAll(':scope > details > summary')].map(
      (s) => s.textContent!.match(/ ms([a-z]+\.[a-z]+)/)![1],
    );
    expect(inside.indexOf('cart.added')).toBeLessThan(inside.indexOf('cart.calculated'));
    tab('logs');
    expect(body()).not.toMatch(/event (sdk|cart)\./);
  });

  it('filters the logs', async () => {
    const next = await start('<span data-next-display="cart.nope"></span>');
    await next.actions.addItem(1);
    await developer();
    menuItem('Logs').click();
    const filter = $<HTMLInputElement>('input');
    filter.value = 'unknown display';
    filter.dispatchEvent(new Event('input'));
    expect(body()).toContain('unknown display path "cart.nope"');
    expect(body()).not.toContain('api POST');
    expect($('.body .row .ldot, .body summary .ldot').dataset.level).toBe('warn');
    expect(body()).not.toContain('{');
    filter.value = '';
    filter.dispatchEvent(new Event('input'));
    const chip = (label: string) =>
      [...shadow().querySelectorAll<HTMLButtonElement>('.echips button')].find((b) =>
        b.textContent!.startsWith(label),
      )!;
    chip('Warnings').click();
    expect(chip('Warnings').getAttribute('aria-pressed')).toBe('true');
    expect(
      new Set(
        [...shadow().querySelectorAll<HTMLElement>('.body > .row .ldot, .body > details > summary .ldot')].map(
          (d) => d.dataset.level,
        ),
      ),
    ).toEqual(new Set(['warn']));
    chip('All').click();
    expect(body()).toContain('api POST');
  });

  it('counts issues on the button and lists each once, with the element behind it', async () => {
    const next = await start('<span data-next-display="cart.nope"></span><button data-next-package-id="999"></button>');
    await next.actions.addItem(1);
    next.on('nope:event' as never, () => {});
    await vi.waitFor(() => expect($('.issues').textContent).toBe('3 Issues'));
    expect($('.issues').classList.contains('amber')).toBe(true);
    $('.fab').click();
    menuItem('Issues').click();
    expect(body()).toContain('Page setup · 2');
    expect(body()).toContain('data-next-display="cart.nope" → unknown path');
    expect(body()).toContain('data-next-package-id="999" → not in this campaign');
    expect(body()).toContain('Warnings and errors · 1');
    expect(body()).toContain('next.on: unknown event "nope:event"');
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
    await developer();
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
    await developer();
    expect(menuItem('Journey').textContent).toBe('Journey1 page in this tab');
    expect($('.mnote').textContent).toBe('Debug stays on in this tab until you turn it off.');
    menuItem('Reset saved data').click();
    expect(assign).not.toHaveBeenCalled();
    await vi.waitFor(() =>
      expect($('.mnote').textContent).toBe("Click again to clear this funnel's cart, form and order."),
    );
    expect(menuItem('Reset saved data').dataset.variant).toBe('destructive');
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

  it('lists the tracking events sent on this page, each opening to the event next.analytics.on gets', async () => {
    const next = await start('<button data-next-package-id="1">Buy</button>');
    const got: Array<{ event_type: string; event_id: string }> = [];
    next.analytics.on('product_added_to_cart', (event) => {
      got.push(event);
    });
    const layer = () => (window as unknown as { NextDataLayer?: Array<{ event: string }> }).NextDataLayer ?? [];
    await vi.waitFor(() => expect(layer().map((e) => e.event)).toContain('dl_view_item'));
    await next.actions.addItem(1);
    await vi.waitFor(() => expect(layer().map((e) => e.event)).toContain('dl_add_to_cart'));
    $('.fab').click();
    menuItem('Analytics').click();
    const rows = [...shadow().querySelectorAll<HTMLDetailsElement>('.body > details')];
    const name = (d: HTMLDetailsElement) => d.querySelector('summary')!.textContent!.match(/^\S+ ([a-z_]+)/)![1];
    expect(new Set(rows.map(name))).toEqual(
      new Set(['cart_updated', 'page_viewed', 'product_added_to_cart', 'product_viewed']),
    );
    expect(name(rows.at(-1)!)).toBe('page_viewed');
    const added = rows.find((d) => name(d) === 'product_added_to_cart')!;
    expect(added.querySelector('summary')!.textContent).toMatch(
      /^\d\d:\d\d:\d\d\.\d{3} product_added_to_cart Earbuds ×1 ×1 · \$49\.00$/,
    );
    expect([...added.querySelectorAll<HTMLElement>(':scope > summary .amarks .icon')].map((i) => i.title)).toContain(
      'NextDataLayer',
    );
    added.open = true;
    const event = [...added.querySelectorAll<HTMLDetailsElement>(':scope > details')][0]!;
    expect(event.querySelector('summary')!.textContent).toMatch(/^next\.analytics\.on/);
    event.open = true;
    expect(event.textContent).toContain(got[0]!.event_id);
    expect(event.textContent).toContain('event_type "product_added_to_cart"');
  });

  it('lists every SDK element with what it resolves to', async () => {
    const next = await start(
      '<p data-next-show="cart.total"><span data-next-display="cart.total"></span></p><span data-next-display="cart.nope"></span>',
    );
    await next.actions.addItem(1);
    await developer();
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
    await developer();
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
    await developer();
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

  it('starts on the right side and moves to the left from settings', async () => {
    await start();
    expect($('.root').classList.contains('right')).toBe(true);
    settings();
    const side = menuItem;
    expect(side('Right').getAttribute('aria-checked')).toBe('true');
    side('Right').click();
    expect($('.root').classList.contains('right')).toBe(true);
    side('Left').click();
    expect($('.root').classList.contains('right')).toBe(false);
    expect(side('Left').getAttribute('aria-checked')).toBe('true');
    expect($('.head [aria-label="Move to the right"]')).not.toBeNull();
  });

  it('styles the panel and each view with separate class names, never restyling a tsugi component', async () => {
    await start();
    expect(shadow().querySelector('style')!.textContent).toBe(
      TSUGI_CSS + PANEL_CSS + CART_CSS + CHECKOUT_CSS + JOURNEY_CSS + LOCALE_CSS + CONFIG_CSS + ANALYTICS_CSS,
    );
    const classes = (css: string) => new Set([...css.matchAll(/(?:^|[},])\s*\.([a-z][\w-]*)/gm)].map((m) => m[1]));
    const panel = classes(PANEL_CSS);
    const cart = classes(CART_CSS);
    const journey = classes(JOURNEY_CSS);
    const checkout = classes(CHECKOUT_CSS);
    const locale = classes(LOCALE_CSS);
    const config = classes(CONFIG_CSS);
    const analytics = classes(ANALYTICS_CSS);
    const sheets = [panel, cart, journey, checkout, locale, config, analytics];
    expect(
      sheets.flatMap((sheet, i) => [...sheet].filter((name) => sheets.slice(0, i).some((s) => s.has(name)))),
    ).toEqual([]);
    const rules = [
      ...(PANEL_CSS + CART_CSS + CHECKOUT_CSS + JOURNEY_CSS + LOCALE_CSS + CONFIG_CSS + ANALYTICS_CSS).matchAll(
        /^\.([a-z][\w-]*)\{/gm,
      ),
    ];
    const counts = rules.reduce<Record<string, number>>((n, [, name]) => ({ ...n, [name!]: (n[name!] ?? 0) + 1 }), {});
    expect(Object.entries(counts).filter(([, n]) => n > 1)).toEqual([]);
    const code = readdirSync('src/debug')
      .filter((file) => file !== 'styles.ts')
      .map((file) => readFileSync(`src/debug/${file}`, 'utf8'))
      .join('\n');
    const unused = (names: Set<string | undefined>) =>
      [...names].filter((name) => !new RegExp(`(?<![\\w-])${name}(?![\\w-])`).test(code));
    expect(sheets.flatMap(unused)).toEqual([]);
    const vendored = readFileSync('scripts/tsugi.mjs', 'utf8').match(/const COMPONENTS = \[([^\]]*)\]/)![1]!;
    const CLASSES: Record<string, string> = { button: 'btn', 'native-select': 'select', scrollbar: 'scrollbar-sm' };
    expect(unused(new Set([...vendored.matchAll(/'([\w-]+)'/g)].map(([, name]) => CLASSES[name!] ?? name)))).toEqual(
      [],
    );
    const components = ['badge', 'btn', 'card', 'empty', 'input', 'journey', 'select', 'stat', 'tabs', 'timeline'];
    expect(sheets.flatMap((sheet) => [...sheet]).filter((name) => components.includes(name!))).toEqual([]);
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
    const ours = PANEL_CSS + CART_CSS + CHECKOUT_CSS + JOURNEY_CSS + LOCALE_CSS + CONFIG_CSS + ANALYTICS_CSS;
    expect([...defined(ours)].filter((name) => tokens.has(name))).toEqual([]);
    expect(PANEL_CSS).toMatch(/\.link\{[^}]*\}\s*\.link\.danger\{color:var\(--destructive\)\}/);
    expect(CART_CSS + CHECKOUT_CSS + JOURNEY_CSS + LOCALE_CSS + CONFIG_CSS + ANALYTICS_CSS).not.toMatch(
      /#[\da-f]{3,8}\b|rgba?\(|oklch\(/i,
    );
    expect(shadow().host.classList.contains('dark')).toBe(true);
    dark.mockRestore();
  });

  it('draws light or dark as picked in the menu, over the system, for the rest of the tab', async () => {
    const system = vi.spyOn(window, 'matchMedia').mockReturnValue({
      matches: true,
      addEventListener: () => {},
    } as unknown as MediaQueryList);
    await start();
    const dark = () => shadow().host.classList.contains('dark');
    const theme = menuItem;
    settings();
    expect(theme('Auto').getAttribute('aria-checked')).toBe('true');
    expect(dark()).toBe(true);
    theme('Light').click();
    expect(dark()).toBe(false);
    expect(theme('Light').getAttribute('aria-checked')).toBe('true');
    expect(Object.values(sessionStorage).some((v) => v.includes('"theme":"light"'))).toBe(true);
    theme('Dark').click();
    expect(dark()).toBe(true);
    system.mockReturnValue({ matches: false, addEventListener: () => {} } as unknown as MediaQueryList);
    theme('Auto').click();
    expect(dark()).toBe(true);
    system.mockRestore();
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
