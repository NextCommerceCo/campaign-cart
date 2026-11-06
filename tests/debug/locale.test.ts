import { afterEach, describe, expect, it, vi } from 'vitest';
import type { VisitorGeo } from '../../src/engine/geo';
import type { Campaign } from '../../src/engine/types';
import { fakeApi, json } from '../fixtures/api';
import { campaign } from '../fixtures/campaign';

const shadow = () => document.querySelector('next-debug')!.shadowRoot!;
const $ = <E extends HTMLElement = HTMLElement>(selector: string) => shadow().querySelector<E>(selector)!;
const view = () => $('.root').dataset.view;
const popover = () => $('.geo').textContent!;
const globe = () => $<HTMLButtonElement>('.head [aria-label="Visitor geo"]');
const menuItem = (label: string) =>
  [
    ...shadow().querySelectorAll<HTMLElement>(
      '.menu :is([role=menuitem], [role=menuitemcheckbox], [role=menuitemradio])',
    ),
  ].find((b) => b.querySelector(':scope > span:not(.icon):not(.mval)')?.firstChild?.textContent === label)!;
const select = (label: string) => $<HTMLSelectElement>(`.lpill select[aria-label^="${label}:"]`);
const choose = (label: string, value: string) => {
  select(label).value = value;
  select(label).dispatchEvent(new Event('change'));
};
const options = (label: string) => [...select(label).options].map((o) => [o.value, o.text]);
const notes = () =>
  [...shadow().querySelectorAll<HTMLElement>('.lpill')].map((p) => [
    p.title.slice(p.title.indexOf(' · ') + 3),
    p.hasAttribute('data-warn') ? 'lwarn' : '',
  ]);
const sources = () => notes().map(([text]) => text);
const visitor = () => $('.lwhere').textContent!;

const page: Campaign = {
  ...campaign,
  available_shipping_countries: [
    { code: 'US', label: 'United States' },
    { code: 'GB', label: 'United Kingdom' },
    { code: 'TH', label: 'Thailand' },
  ],
  available_currencies: [
    { code: 'USD', label: '$ USD' },
    { code: 'EUR', label: '€ EUR' },
  ],
};
const FORM =
  '<meta name="next-success-url" content="/thanks"><form data-next-checkout="form"><input data-next-checkout-field="email"></form>';
const GEO: VisitorGeo = {
  ip: '203.0.113.7',
  country: { code: 'TH', name: 'Thailand' },
  state: { code: '42', name: 'Loei' },
  city: 'Loei',
  postcode: '42000',
  timezone: 'Asia/Bangkok',
  latitude: 17.486,
  longitude: 101.7223,
  language: 'th-TH',
  currency: 'THB',
  region: { code: '142', name: 'Asia', subregion: { code: '035', name: 'South-eastern Asia' } },
  source: 'cf',
};

const geoAnswers = (answer?: unknown) => {
  const api = fakeApi();
  const asked: string[] = [];
  const fetch = (async (url: RequestInfo | URL, init?: RequestInit) => {
    if (!String(url).includes('/v1/geo')) return api.fetch(url, init);
    asked.push(String(url));
    return answer ? json(answer) : json({}, 503);
  }) as typeof globalThis.fetch;
  return { fetch, asked };
};

async function start(markup = '', { page: shown = page, fetch = fakeApi().fetch, lang = '', keep = false } = {}) {
  if (!keep) sessionStorage.clear();
  vi.resetModules();
  const { boot } = await import('../../src/boot');
  document.body.innerHTML = markup;
  vi.stubGlobal('fetch', fetch);
  for (const level of ['debug', 'info', 'warn'] as const) vi.spyOn(console, level).mockImplementation(() => {});
  const next = boot(
    { apiKey: 'pk_test', apiBase: 'https://api.test', funnel: 'f1', reset: false, debug: true, lang },
    Promise.resolve(shown),
  );
  await vi.waitFor(() => expect(document.querySelector('next-debug')).not.toBeNull(), { timeout: 5000 });
  return next;
}

const openLocale = () => {
  while (view() !== 'menu') $('.fab').click();
  menuItem('Locale').click();
  expect([view(), $('.geo').hidden]).toEqual(['panel', false]);
};

const answered = () => vi.waitFor(() => expect(visitor()).not.toContain('Asking'));

afterEach(async () => {
  await new Promise((r) => setTimeout(r, 30));
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  document.body.innerHTML = '';
  sessionStorage.clear();
  localStorage.clear();
  history.replaceState(null, '', '/');
});

describe('locale tab', () => {
  it('asks the geo only once the menu opens, and shows the visitor from it', async () => {
    const geo = geoAnswers(GEO);
    await start('', { fetch: geo.fetch });
    await new Promise((r) => setTimeout(r, 20));
    expect(geo.asked).toEqual([]);
    openLocale();
    expect(visitor()).toBe('Asking where the visitor is…');
    await answered();
    expect(geo.asked).toEqual(['https://i18n-rules.nextcommerce.com/v1/geo?lang=en']);
    expect(visitor()).toMatch(/^ThailandLoei · \d\d:\d\d there$/);
    const flag = $<HTMLImageElement>('.lwhere .lflag');
    expect(flag.getAttribute('src')).toBe('https://i18n-rules.nextcommerce.com/v1/flags/th.svg');
    expect(flag.alt).toBe('');
    const rows = Object.fromEntries(
      [...shadow().querySelectorAll('.lrows dt')].map((dt) => [dt.textContent, dt.nextElementSibling!.textContent]),
    );
    expect(rows).toEqual({
      Region: 'Loei · South-eastern Asia',
      Postcode: '42000',
      'Time zone': expect.stringMatching(/^Asia\/Bangkok · \d\d:\d\d there$/),
      Coordinates: '17.49, 101.72',
      Currency: 'THB',
      'Browser language': 'th-TH',
      IP: '203.0.113.7',
      Source: 'Cloudflare edge',
    });
    const map = $<HTMLAnchorElement>('.lrows a');
    expect(map.href).toBe('https://www.openstreetmap.org/?mlat=17.486&mlon=101.7223#map=10/17.486/101.7223');
    expect(map.target).toBe('_blank');
    expect(map.rel).toBe('noreferrer');
    expect(select('Country').value).toBe('TH');
    expect(sources()[0]).toBe('Matches the visitor · geo');
    expect([...shadow().querySelectorAll('.lpill > span:not(.icon):not(.mdot)')].map((s) => s.textContent)).toEqual([
      'TH',
      'USD',
      'EN',
    ]);
    expect($('.lswitch').parentElement!.classList.contains('panel')).toBe(true);
  });

  it('lists the campaign currencies and the 12 languages, and reloads with ?currency= or ?lang=', async () => {
    await start();
    const assign = vi.spyOn(location, 'assign').mockImplementation(() => {});
    openLocale();
    expect(options('Currency')).toEqual([
      ['USD', '$ USD'],
      ['EUR', '€ EUR'],
    ]);
    expect(select('Currency').value).toBe('USD');
    expect(options('Language').map(([code]) => code)).toEqual([
      'da',
      'de',
      'en',
      'es',
      'fi',
      'fr',
      'it',
      'nl',
      'no',
      'pt',
      'sv',
      'th',
    ]);
    expect(options('Language')).toContainEqual(['th', 'ไทย']);
    expect(select('Language').value).toBe('en');
    expect(options('Country').map(([code]) => code)).toEqual(['US', 'GB', 'TH']);
    choose('Currency', 'EUR');
    expect(new URL(assign.mock.calls[0]![0] as string).searchParams.get('currency')).toBe('EUR');
    choose('Language', 'da');
    expect(new URL(assign.mock.calls[1]![0] as string).searchParams.get('lang')).toBe('da');
  });

  it('names where the currency and language in use come from', async () => {
    await start('', { lang: 'de' });
    openLocale();
    expect(sources()).toEqual([
      'not chosen yet',
      'campaign default · changing reloads',
      'nextConfig.locale · changing reloads',
    ]);
    history.replaceState(null, '', '/?currency=EUR&lang=de');
    await start('', { lang: 'de' });
    openLocale();
    expect(sources()).toEqual(['not chosen yet', '?currency= · changing reloads', '?lang= · changing reloads']);
    history.replaceState(null, '', '/');
    await start();
    openLocale();
    expect(sources()).toEqual(['not chosen yet', 'campaign default · changing reloads', 'campaign · changing reloads']);
  });

  it('sets the country of the checkout form on a checkout page', async () => {
    const next = await start(FORM);
    await vi.waitFor(() => expect(next.getState().checkout?.countries.length).toBe(3));
    openLocale();
    choose('Country', 'GB');
    expect(next.getState().checkout!.fields.country).toBe('GB');
    await vi.waitFor(() => expect(select('Country').value).toBe('GB'));
    expect(sources()[0]).toBe('checkout form');
  });

  it('keeps a country chosen off checkout and sets it on the next page with a checkout', async () => {
    await start();
    openLocale();
    choose('Country', 'GB');
    await vi.waitFor(() => expect(sources()[0]).toBe('pending, applies at checkout'));
    expect(select('Country').value).toBe('GB');
    const next = await start(FORM, { keep: true });
    await vi.waitFor(() => expect(next.getState().checkout?.fields.country).toBe('GB'));
    openLocale();
    expect(sources()[0]).toBe('checkout form');
  });

  it('says when the request has no geo, still showing the IP and comparing the browser language', async () => {
    const geo = geoAnswers({
      ...GEO,
      country: null,
      state: null,
      city: null,
      postcode: null,
      timezone: null,
      latitude: null,
      longitude: null,
      currency: null,
      region: null,
      language: 'en-US',
      source: 'default',
    });
    await start('', { fetch: geo.fetch });
    openLocale();
    await answered();
    expect(visitor()).toBe('The edge resolved no country: a local request or a Tor exit');
    expect([...shadow().querySelectorAll('.lrows dt')].map((dt) => dt.textContent)).toEqual([
      'Browser language',
      'IP',
      'Source',
    ]);
    expect(shadow().querySelector('.lflag')).toBeNull();
    expect(notes()).toEqual([
      ['not chosen yet', ''],
      ['campaign default · changing reloads', ''],
      ['Matches the browser (en-US) · changing reloads', ''],
    ]);
  });

  it("says when the address service didn't answer", async () => {
    const geo = geoAnswers();
    await start('', { fetch: geo.fetch });
    openLocale();
    await answered();
    expect(visitor()).toBe("The address service didn't answer; reload to ask again");
    expect(shadow().querySelector('.lrows')).toBeNull();
    expect(notes().filter(([, tone]) => tone)).toEqual([]);
  });

  it('notes on each setting how it compares with the visitor: no currency or shipping for them, another language', async () => {
    const geo = geoAnswers(GEO);
    await start('', {
      fetch: geo.fetch,
      page: { ...page, available_shipping_countries: page.available_shipping_countries!.slice(0, 2) },
    });
    openLocale();
    await answered();
    expect(notes()).toEqual([
      ["Thailand isn't a shipping country: the checkout opens on United States", 'lwarn'],
      ["Visitor's is THB, not one this campaign sells in · changing reloads", 'lwarn'],
      ['Browser asks th-TH · changing reloads', 'lwarn'],
    ]);
  });

  it('notes on each setting how it compares with the visitor: an offered currency, a language without texts', async () => {
    const geo = geoAnswers({ ...GEO, currency: 'EUR', language: 'ja-JP' });
    await start('', { fetch: geo.fetch });
    openLocale();
    await answered();
    expect(notes()).toEqual([
      ['Matches the visitor · geo', ''],
      ["Visitor's is EUR: a link with ?currency=EUR · changing reloads", 'lwarn'],
      ['Browser asks ja-JP, no texts in it · changing reloads', ''],
    ]);
  });

  it('sums up the country, currency and language in the menu, marked when they differ from geo', async () => {
    const value = () => menuItem('Locale').querySelector('.mval')!;
    const differs = geoAnswers(GEO);
    await start('', { fetch: differs.fetch });
    $('.fab').click();
    expect(value().textContent).toBe('USD · en');
    await vi.waitFor(() => expect(value().textContent).toBe('TH · USD · en'));
    expect(value().querySelector('.mdot')).not.toBeNull();
    const same = geoAnswers({
      ...GEO,
      country: { code: 'US', name: 'United States' },
      currency: 'USD',
      language: 'en-US',
    });
    await start('', { fetch: same.fetch });
    while (view() !== 'menu') $('.fab').click();
    await vi.waitFor(() => expect(value().textContent).toBe('US · USD · en'));
    expect(value().querySelector('.mdot')).toBeNull();
    menuItem('Locale').click();
    expect(popover()).toContain('United States');
    expect(shadow().querySelector('.lpill[data-warn]')).toBeNull();
  });

  it('opens geo details from the globe in the panel header, and closes them on Esc or a click outside', async () => {
    const differs = geoAnswers(GEO);
    await start('', { fetch: differs.fetch });
    while (view() !== 'menu') $('.fab').click();
    menuItem('Journey').click();
    expect([$('.geo').hidden, globe().getAttribute('aria-expanded')]).toEqual([true, 'false']);
    expect(shadow().querySelector('[data-tab="locale"]')).toBeNull();
    await vi.waitFor(() => expect(shadow().querySelectorAll('.lpill[data-warn]')).toHaveLength(2));
    expect(globe().querySelector('img')).toBeNull();
    globe().click();
    expect([$('.geo').hidden, globe().getAttribute('aria-expanded')]).toEqual([false, 'true']);
    await answered();
    expect(shadow().querySelector('.geo select')).toBeNull();
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect([view(), $('.geo').hidden]).toEqual(['panel', true]);
    globe().click();
    $('.body').click();
    await vi.waitFor(() => expect($('.geo').hidden).toBe(true));
    expect(view()).toBe('panel');
  });
});
