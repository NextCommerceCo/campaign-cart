import { afterEach, describe, expect, it, vi } from 'vitest';
import { boot } from '../../../src/boot';
import { configModal } from '../../../src/debug/tabs/config';
import type { Engine } from '../../../src/engine/engine';
import type { DebugActions } from '../../../src/debug/state';
import { fakeApi } from '../../fixtures/api';
import { campaign } from '../../fixtures/campaign';

type Win = { nextConfig?: Record<string, unknown> };
const win = window as unknown as Win;
const shadow = () => document.querySelector('next-debug')!.shadowRoot!;
const $ = <E extends HTMLElement = HTMLElement>(selector: string) => shadow().querySelector<E>(selector)!;
const view = () => $('.root').dataset.view;
const menuItem = (label: string) =>
  [...shadow().querySelectorAll<HTMLElement>('.menu [role=menuitem]')].find(
    (b) => b.querySelector(':scope > span:not(.icon):not(.mval)')?.firstChild?.textContent === label,
  )!;
const modal = () => $<HTMLDialogElement>('dialog.cmodal');
const snippet = () => modal().querySelector('.ccode')!.textContent!;
const row = (label: string) =>
  [...modal().querySelectorAll<HTMLElement>('.crow')].find(
    (r) => r.querySelector('.clabel > span')!.textContent === label,
  )!;
const from = (label: string) => row(label).querySelector('.cfrom')!.textContent;
const value = (label: string) => row(label).querySelector('.cval')!.textContent;
const control = <E extends HTMLElement>(label: string) => modal().querySelector<E>(`[aria-label="${label}"]`)!;
const footer = (label: string) =>
  [...modal().querySelectorAll<HTMLButtonElement>('footer .btn')].find((b) => b.textContent === label)!;

const PAGE = () => ({
  apiKey: 'pk_page',
  funnel: 'page-funnel',
  storeName: 'Olympus',
  analytics: {
    providers: { facebook: { enabled: true }, gtm: { enabled: false }, nextCampaign: { enabled: false } },
    destinations: { ga4: { enabled: true } },
  },
  locale: 'fr',
  translations: { fr: { 'fields.postcode.label': 'Code postal', payment: { card: 'Carte' } } },
  addressConfig: { countries: [{ code: 'US' }, { code: 'CA' }] },
  theme: 'dark',
  onReady: () => {},
});

async function start(config: Record<string, unknown> = PAGE()) {
  win.nextConfig = config;
  document.body.innerHTML = '';
  vi.stubGlobal('fetch', fakeApi().fetch);
  for (const level of ['debug', 'info', 'warn'] as const) vi.spyOn(console, level).mockImplementation(() => {});
  boot(
    { apiKey: 'pk_test', apiBase: 'https://api.test', funnel: 'f1', reset: false, debug: true },
    Promise.resolve(campaign),
  );
  await vi.waitFor(() => expect(document.querySelector('next-debug')).not.toBeNull());
}

const openFromMenu = () => {
  while (view() !== 'menu') $('.fab').click();
  if (!shadow().querySelector('.mtop')) $('.mhead [aria-label="Settings"]').click();
  menuItem('Page config').click();
};

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  document.body.innerHTML = '';
  sessionStorage.clear();
  delete win.nextConfig;
});

describe('page config', () => {
  it('shows each section with its value and where it comes from', async () => {
    await start();
    openFromMenu();
    expect(modal().open).toBe(true);
    expect([...modal().querySelectorAll('.chead')].map((el) => el.textContent)).toEqual([
      'Analytics',
      'Language',
      'Checkout',
      'Page',
      'Loader keys',
      'Other keys',
    ]);
    expect(from('Google Analytics 4')).toBe('');
    expect(control<HTMLInputElement>('Google Analytics 4').checked).toBe(true);
    expect(from('Meta pixel')).toBe('0.4.xproviders.facebook');
    expect(row('Meta pixel').querySelector('.badge')!.getAttribute('data-variant')).toBe('warning');
    expect(from('Meta store name')).toBe('0.4.xstoreName');
    expect(control<HTMLInputElement>('Meta store name').value).toBe('Olympus');
    expect(from('Google Tag Manager')).toBe('0.4.xproviders.gtm');
    expect(control<HTMLInputElement>('Google Tag Manager').checked).toBe(false);
    expect(from('RudderStack')).toBe('');
    expect(control<HTMLInputElement>('RudderStack').getAttribute('role')).toBe('switch');
    expect(from('NEXT analytics')).toBe('');
    expect(from('Language')).toBe('');
    expect(control<HTMLSelectElement>('Language').value).toBe('fr');
    expect([...control<HTMLSelectElement>('Language').options].slice(0, 2).map((o) => o.text)).toEqual([
      'Campaign default',
      'Dansk',
    ]);
    expect(value('Translations')).toBe('fr · 2 texts');
    expect(value('Countries')).toBe('US, CA');
    expect(value('Hidden states')).toBe('not set');
  });

  it('writes the 0.4.x analytics keys in the current format, without the loader keys', async () => {
    await start();
    openFromMenu();
    expect(modal().querySelector('.cedit > .cnote')!.textContent).toBe(
      '0.4.x keys are shown in the current format: providers.gtm → destinations.gtm, providers.facebook → destinations.meta, storeName → destinations.meta.storeName.',
    );
    expect(snippet()).toBe(`window.nextConfig = {
  analytics: {
    providers: {
      nextCampaign: { enabled: false },
    },
    destinations: {
      ga4: { enabled: true },
      gtm: { enabled: false },
      meta: { enabled: true, storeName: 'Olympus' },
    },
  },
  locale: 'fr',
  translations: {
    fr: {
      'fields.postcode.label': 'Code postal',
      payment: { card: 'Carte' },
    },
  },
  addressConfig: {
    countries: [{ code: 'US' }, { code: 'CA' }],
  },
  theme: 'dark',
  /* onReady: function: keep yours */
};
`);
    expect(value('apiKey')).toBe('pk_page');
    expect(from('apiKey')).toBe('script tag: data-campaign');
    expect(value('funnel')).toBe('page-funnel');
    expect(value('theme')).toBe('dark');
    expect(from('theme')).toBe('not read by the SDK');
    expect(value('onReady')).toBe('function');
  });

  it('updates the snippet as a switch, the language or a text changes', async () => {
    await start({ locale: 'fr' });
    openFromMenu();
    expect(snippet()).toBe("window.nextConfig = {\n  locale: 'fr',\n};\n");
    expect(footer('Reset to page config').hidden).toBe(true);
    const rudderstack = control<HTMLInputElement>('RudderStack');
    rudderstack.click();
    expect(snippet()).toContain('destinations: {\n      rudderstack: { enabled: true },');
    expect(from('RudderStack')).toBe('edited');
    const language = control<HTMLSelectElement>('Language');
    language.value = 'th';
    language.dispatchEvent(new Event('change'));
    expect(snippet()).toContain("locale: 'th',");
    language.value = '';
    language.dispatchEvent(new Event('change'));
    expect(snippet()).not.toContain('locale');
    const pageType = control<HTMLInputElement>('Page type');
    pageType.value = 'checkout';
    pageType.dispatchEvent(new Event('input'));
    expect(snippet()).toContain("pageType: 'checkout',");
    expect(footer('Reset to page config').hidden).toBe(false);
    footer('Reset to page config').click();
    expect(snippet()).toBe("window.nextConfig = {\n  locale: 'fr',\n};\n");
    expect(control<HTMLInputElement>('RudderStack').checked).toBe(false);
  });

  it('copies the snippet and downloads it as next-config.js', async () => {
    await start();
    openFromMenu();
    const writeText = vi.fn(() => Promise.resolve());
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
    footer('Copy').click();
    expect(writeText).toHaveBeenCalledWith(snippet());
    await vi.waitFor(() => expect(footer('Copied')).toBeDefined());
    const links: HTMLAnchorElement[] = [];
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) {
      links.push(this);
    });
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:config');
    footer('Download .js').click();
    expect(links.map((a) => [a.download, a.getAttribute('href')])).toEqual([['next-config.js', 'blob:config']]);
  });

  it('tries the config on this tab: the next page boots with it, the loader keys stay the page’s', async () => {
    await start();
    const reload = vi.spyOn(location, 'reload').mockImplementation(() => {});
    openFromMenu();
    control<HTMLInputElement>('RudderStack').click();
    const language = control<HTMLSelectElement>('Language');
    language.value = '';
    language.dispatchEvent(new Event('change'));
    footer('Try on this tab').click();
    expect(reload).toHaveBeenCalledTimes(1);

    await start({ ...PAGE(), apiKey: 'pk_other_page' });
    const config = win.nextConfig!;
    expect(config.apiKey).toBe('pk_other_page');
    expect(config.funnel).toBe('page-funnel');
    expect(config).toMatchObject({
      analytics: {
        destinations: { rudderstack: { enabled: true }, meta: { enabled: true, storeName: 'Olympus' } },
      },
      locale: null,
      storeName: null,
      theme: 'dark',
    });
    expect(typeof config.onReady).toBe('function');
    $('.fab').click();
    expect($('.mtry').textContent).toContain('This tab tries a nextConfig of its own.');
    openFromMenu();
    expect(menuItem('Page config').textContent).toContain('Trying');
    expect(modal().querySelector('h2')!.textContent).toBe('Page configTrying');
    expect(from('RudderStack')).toBe('tried');
    expect(from('Language')).toBe('');
    expect(modal().querySelector('.cedit > .cnote')).toBeNull();

    footer('Reset to page config').click();
    expect(reload).toHaveBeenCalledTimes(2);
    await start();
    expect(win.nextConfig).toMatchObject({ locale: 'fr', storeName: 'Olympus' });
    $('.fab').click();
    expect(shadow().querySelector('.mtry')).toBeNull();
  });

  it('warns about providers.custom only when it is on', async () => {
    const custom = (enabled: boolean) => ({ analytics: { providers: { custom: { enabled } } } });
    const warned = () => modal().textContent!.includes('providers.custom is not built in');
    await start(custom(false));
    openFromMenu();
    expect(warned()).toBe(false);
    await start(custom(true));
    openFromMenu();
    expect(warned()).toBe(true);
  });

  it('shows the settings, and the code only on the Code tab', async () => {
    await start();
    openFromMenu();
    const tab = (label: string) =>
      [...modal().querySelectorAll<HTMLButtonElement>('[role=tab]')].find((t) => t.textContent === label)!;
    expect(modal().querySelector<HTMLElement>('.cedit')!.hidden).toBe(false);
    expect(modal().querySelector<HTMLElement>('.csnip')!.hidden).toBe(true);
    tab('Code').click();
    expect(modal().querySelector<HTMLElement>('.csnip')!.hidden).toBe(false);
    expect(tab('Code').getAttribute('aria-selected')).toBe('true');
    expect(snippet()).toMatch(/^window\.nextConfig = \{/);
  });

  it('keeps the panel open when Esc closes Page config', async () => {
    await start();
    openFromMenu();
    expect(modal().open).toBe(true);
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(view()).toBe('menu');
  });

  it('opens at a section and focuses its first control', () => {
    win.nextConfig = { locale: 'de' };
    const engine = { getState: () => ({ visit: { params: { lang: 'th' } } }) } as unknown as Engine;
    const debug = { state: () => ({ pages: [], panel: {} }), setConfig: vi.fn() } as unknown as DebugActions;
    const config = configModal(engine, debug, { page: { locale: 'de' }, tried: false }, () => {});
    document.body.append(config.dialog);
    config.open('language');
    expect(config.dialog.open).toBe(true);
    expect(document.activeElement).toBe(config.dialog.querySelector('[aria-label="Language"]'));
    expect(config.dialog.querySelector('[data-section="language"]')!.textContent).toContain(
      '?lang=th in the URL wins over Language on this page.',
    );
    expect(config.trying()).toBe(false);
  });
});
