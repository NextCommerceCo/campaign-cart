import { afterEach, describe, expect, it, vi } from 'vitest';
import type { VisitorGeo } from '../../src/engine/geo';
import type { Campaign } from '../../src/engine/types';
import { fakeApi, json } from '../fixtures/api';
import { campaign } from '../fixtures/campaign';

const shadow = () => document.querySelector('next-debug')!.shadowRoot!;
const $ = <E extends HTMLElement = HTMLElement>(selector: string) => shadow().querySelector<E>(selector)!;
const view = () => $('.root').dataset.view;
const body = () => $('.body').textContent!;
const menuItem = (label: string) =>
  [...shadow().querySelectorAll<HTMLElement>('.menu button')].find((b) => b.firstChild!.textContent === label)!;
const select = (label: string) => $<HTMLSelectElement>(`.lset select[aria-label="${label}"]`);
const choose = (label: string, value: string) => {
  select(label).value = value;
  select(label).dispatchEvent(new Event('change'));
};
const options = (label: string) => [...select(label).options].map((o) => [o.value, o.text]);
const notes = () =>
  [...shadow().querySelectorAll<HTMLElement>('.lnotes li')].map((li) => [li.textContent, li.className]);
const sources = () => [...shadow().querySelectorAll('.lset > div > small')].map((s) => s.textContent);
const visitor = () => $('.lgrid > .block').textContent!;

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
  expect($('[data-tab="locale"]').getAttribute('aria-selected')).toBe('true');
};

const answered = () => vi.waitFor(() => expect(visitor()).not.toContain('Detecting…'));

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
    expect(visitor()).toContain('Detecting…');
    await answered();
    expect(geo.asked).toEqual(['https://i18n-rules.nextcommerce.com/v1/geo?lang=en']);
    expect($('.lplace h4').textContent).toBe('Thailand · Loei 42000');
    expect($('.lplace p').textContent).toBe('Asia · South-eastern Asia');
    const flag = $<HTMLImageElement>('.lflag');
    expect(flag.getAttribute('src')).toBe('https://i18n-rules.nextcommerce.com/v1/flags/th.svg');
    expect(flag.alt).toBe('');
    const rows = Object.fromEntries(
      [...shadow().querySelectorAll('.lrows dt')].map((dt) => [dt.textContent, dt.nextElementSibling!.textContent]),
    );
    expect(rows).toEqual({
      'Time zone': expect.stringMatching(/^Asia\/Bangkok · \d\d:\d\d there$/),
      State: 'Loei (42)',
      Currency: 'THB',
      'Browser language': 'th-TH',
      Coordinates: '17.49, 101.72',
      IP: '203.0.113.7',
      Source: 'Cloudflare edge',
    });
    const map = $<HTMLAnchorElement>('.lrows a');
    expect(map.href).toBe('https://www.openstreetmap.org/?mlat=17.486&mlon=101.7223#map=10/17.486/101.7223');
    expect(map.target).toBe('_blank');
    expect(map.rel).toBe('noreferrer');
    expect(select('Country').value).toBe('TH');
    expect(sources()[0]).toBe('geo');
    expect([...shadow().querySelectorAll('.lset > span')].map((s) => s.textContent)).toEqual([
      'Country',
      'Thailand',
      'Currency',
      'THB',
      'Language',
      'th-TH',
    ]);
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
    expect(sources()).toEqual(['not chosen yet', 'campaign default', 'nextConfig.locale']);
    history.replaceState(null, '', '/?currency=EUR&lang=de');
    await start('', { lang: 'de' });
    openLocale();
    expect(sources()).toEqual(['not chosen yet', '?currency=', '?lang=']);
    history.replaceState(null, '', '/');
    await start();
    openLocale();
    expect(sources()).toEqual(['not chosen yet', 'campaign default', 'campaign']);
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

  it('says when the request has no geo, still showing the IP and browser language', async () => {
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
    expect($('.lplace h4').textContent).toBe('No geo on this request');
    expect([...shadow().querySelectorAll('.lrows dt')].map((dt) => dt.textContent)).toEqual([
      'Browser language',
      'IP',
      'Source',
    ]);
    expect($('.lrows').textContent).toContain('a local request or a Tor exit');
    expect(shadow().querySelector('.lflag')).toBeNull();
    expect(notes()).toEqual([]);
    expect(sources()[0]).toBe('not chosen yet');
  });

  it("says when the address service didn't answer", async () => {
    const geo = geoAnswers();
    await start('', { fetch: geo.fetch });
    openLocale();
    await answered();
    expect(visitor()).toContain("The address service didn't answer");
    expect(notes()).toEqual([]);
  });

  it('notes what a shopper from there gets: no currency or shipping for them, browser language ignored', async () => {
    const geo = geoAnswers(GEO);
    await start('', {
      fetch: geo.fetch,
      page: { ...page, available_shipping_countries: page.available_shipping_countries!.slice(0, 2) },
    });
    openLocale();
    await answered();
    expect(notes()).toEqual([
      [
        "THB isn't one of this campaign's currencies, so a shopper from Thailand sees the campaign's default currency.",
        'lwarn',
      ],
      ["Thailand isn't a shipping country, so the checkout opens on United States.", 'lwarn'],
      ['The browser asks for th-TH; texts are in English.', ''],
    ]);
  });

  it('notes what a shopper from there gets: an offered currency, a shipping country, a language without texts', async () => {
    const geo = geoAnswers({ ...GEO, currency: 'EUR', language: 'ja-JP' });
    await start('', { fetch: geo.fetch });
    openLocale();
    await answered();
    expect(notes()).toEqual([
      ["A shopper from Thailand sees the campaign's default currency; a link with ?currency=EUR shows EUR.", ''],
      ['The checkout opens on Thailand.', ''],
      ['The browser asks for ja-JP, a language without texts here; texts are in English.', ''],
    ]);
  });

  it('sums up the country, currency and language in the menu, marked when they differ from geo', async () => {
    const value = () => menuItem('Locale').querySelector('.value')!;
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
    expect(body()).toContain('Locale · US · USD · en');
  });
});
