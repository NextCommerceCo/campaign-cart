import type { Engine } from '../engine/engine';
import { localeOf } from '../engine/format';
import { type VisitorGeo, visitorGeo } from '../engine/geo';
import { baseLang, I18N_RULES } from '../engine/texts';
import type { Send } from '../engine/types';
import type { DebugActions } from './state';
import { type Child, empty, h } from './view';

export const LANGUAGES: Record<string, string> = {
  da: 'Dansk',
  de: 'Deutsch',
  en: 'English',
  es: 'Español',
  fi: 'Suomi',
  fr: 'Français',
  it: 'Italiano',
  nl: 'Nederlands',
  no: 'Norsk',
  pt: 'Português',
  sv: 'Svenska',
  th: 'ไทย',
};

type Option = [code: string, name: string];
type Note = [text: string, warn?: boolean];

const reload = (param: string, value: string) => {
  const url = new URL(location.href);
  url.searchParams.set(param, value);
  location.assign(url.href);
};

const picker = (label: string, options: Option[], value: string | undefined, onchange: (code: string) => void) => {
  const known = !value || options.some(([code]) => code === value);
  const list: Option[] = [...(known ? [] : [[value, value] as Option]), ...options];
  if (!list.length) list.push(['', '—']);
  const select = h(
    'select',
    { className: 'select', disabled: list.length < 2, onchange: () => onchange(select.value) },
    ...list.map(([code, name]) => h('option', { value: code }, name)),
  );
  select.dataset.size = 'sm';
  select.setAttribute('aria-label', label);
  select.value = value ?? '';
  return select;
};

const localTime = (timeZone: string) => {
  try {
    const at = new Intl.DateTimeFormat('en-GB', { timeZone, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
    return `${timeZone} · ${at.format(new Date())} there`;
  } catch {
    return timeZone;
  }
};

const mapLink = (lat: number, lon: number) =>
  h(
    'a',
    {
      href: `https://www.openstreetmap.org/?mlat=${lat}&mlon=${lon}#map=10/${lat}/${lon}`,
      target: '_blank',
      rel: 'noreferrer',
    },
    `${lat.toFixed(2)}, ${lon.toFixed(2)}`,
  );

const joined = (parts: Array<string | null | undefined>, by = ' · ') => parts.filter(Boolean).join(by);

const card = (title: string, detail: Child, body: Child[] = [], lead: Child = null) =>
  h(
    'div',
    'block',
    h('div', 'bhead', h('div', 'lplace', lead, h('div', {}, h('h4', {}, title), h('p', {}, detail)))),
    ...body,
  );

export interface LocaleSummary {
  /** `US · EUR · en`: the country, currency and language in use. */
  text: string;
  /** Geo answered and one of them is not what geo found. */
  differs: boolean;
}

export interface LocaleTab {
  view(): Child[];
  summary(): LocaleSummary;
}

export function localeTab(engine: Engine, debug: DebugActions, send: Send, render: () => void): LocaleTab {
  let asked = false;
  let answered = false;
  let geo: VisitorGeo | undefined;
  const language = () => baseLang(localeOf(engine.getState()) || 'en');

  const applyPending = () => {
    const code = debug.state().panel.country;
    if (!code || !engine.checkout) return;
    debug.setPanel({ country: undefined });
    engine.checkout.setField('country', code);
  };
  applyPending();
  engine.subscribe(applyPending);

  const ask = () => {
    if (asked) return;
    asked = true;
    void visitorGeo(send, language()).then((found) => {
      geo = found;
      answered = true;
      render();
    });
  };

  const setCountry = (code: string) => {
    if (engine.checkout) return engine.checkout.setField('country', code);
    debug.setPanel({ country: code });
    render();
  };

  const inUse = () => {
    const state = engine.getState();
    const form = engine.checkout ? state.checkout : undefined;
    const pending = form ? undefined : debug.state().panel.country;
    const shipping: Option[] = form?.countries.length
      ? form.countries.map((c) => [c.code, c.name])
      : (state.campaign?.available_shipping_countries ?? []).map((c) => [c.code, c.label]);
    return {
      state,
      shipping,
      country: form?.fields.country || pending || geo?.country?.code,
      countryFrom: form?.fields.country
        ? 'checkout form'
        : pending
          ? 'pending, applies at checkout'
          : geo?.country
            ? 'geo'
            : 'not chosen yet',
      currency: state.campaign?.currency,
      currencyFrom: state.visit.params.currency ? '?currency=' : 'campaign default',
      language: language(),
      languageFrom: state.visit.params.lang ? '?lang=' : state.locale ? 'nextConfig.locale' : 'campaign',
    };
  };

  const visitor = (): Child => {
    if (!answered) return card('Visitor', 'Detecting…');
    if (!geo) return h('div', 'block', empty("The address service didn't answer", 'Reload to ask again.', 'warn'));
    const g = geo;
    const rows: Array<[string, Child]> = [
      ['Time zone', g.timezone && localTime(g.timezone)],
      ['State', g.state && joined([g.state.name, g.state.code && `(${g.state.code})`], ' ')],
      ['Currency', g.currency],
      ['Browser language', g.language],
      [
        'Coordinates',
        typeof g.latitude === 'number' && typeof g.longitude === 'number' && mapLink(g.latitude, g.longitude),
      ],
      ['IP', g.ip],
      ['Source', g.source === 'cf' ? 'Cloudflare edge' : 'No country: a local request or a Tor exit'],
    ];
    const list = h('dl', 'lrows', ...rows.filter(([, v]) => v).flatMap(([k, v]) => [h('dt', {}, k), h('dd', {}, v)]));
    if (!g.country) return card('No geo on this request', 'The edge resolved no country.', [list]);
    const flag = h('img', {
      className: 'lflag',
      alt: '',
      src: `${I18N_RULES}/v1/flags/${g.country.code.toLowerCase()}.svg`,
    });
    return card(
      joined([g.country.name, joined([g.city, g.postcode], ' ')]),
      joined([g.region?.name, g.region?.subregion?.name]) || g.country.code,
      [list],
      flag,
    );
  };

  const notes = (now: ReturnType<typeof inUse>): Note[] => {
    if (!geo?.country) return [];
    const { name, code } = geo.country;
    const { campaign } = now.state;
    const out: Note[] = [];
    if (geo.currency) {
      const offered = (campaign?.available_currencies ?? []).some((c) => c.code === geo!.currency);
      out.push(
        geo.currency === campaign?.currency && !now.state.visit.params.currency
          ? [`A shopper from ${name} sees ${geo.currency}, the campaign's default currency.`]
          : offered
            ? [`A shopper from ${name} sees the default currency; ?currency=${geo.currency} shows ${geo.currency}.`]
            : [`${geo.currency} isn't offered, so a shopper from ${name} sees the default currency.`, true],
      );
    }
    const opens = now.shipping.find(([c]) => c === 'US') ?? now.shipping[0];
    out.push(
      now.shipping.length && !now.shipping.some(([c]) => c === code)
        ? [`${name} isn't a shipping country, so the checkout opens on ${opens![1]}.`, true]
        : [`The checkout opens on ${name}.`],
    );
    if (geo.language) {
      const asks = baseLang(geo.language);
      const texts = LANGUAGES[now.language] ?? now.language;
      out.push(
        !LANGUAGES[asks]
          ? [`The browser asks for ${geo.language}, a language without texts here; texts are in ${texts}.`]
          : asks !== now.language
            ? [`The browser asks for ${geo.language}; texts are in ${texts}.`]
            : [`Texts are in ${texts}, as the browser asks (${geo.language}).`],
      );
    }
    return out;
  };

  const settings = (): Child => {
    const now = inUse();
    const unknown = answered ? '—' : '…';
    const currencies = (now.state.campaign?.available_currencies ?? []).map((c): Option => [c.code, c.label]);
    const rows: Array<[string, string | null | undefined, HTMLSelectElement, string]> = [
      ['Country', geo?.country?.name, picker('Country', now.shipping, now.country, setCountry), now.countryFrom],
      [
        'Currency',
        geo?.currency,
        picker('Currency', currencies, now.currency, (c) => reload('currency', c)),
        now.currencyFrom,
      ],
      [
        'Language',
        geo?.language,
        picker('Language', Object.entries(LANGUAGES), now.language, (c) => reload('lang', c)),
        now.languageFrom,
      ],
    ];
    const said = notes(now);
    return card('In use', 'Next to what geo found.', [
      h(
        'div',
        'lset',
        ...['Setting', 'Geo', 'In use'].map((t) => h('small', {}, t)),
        ...rows.flatMap(([label, found, select, from]) => [
          h('span', {}, label),
          h('span', {}, found || unknown),
          h('div', {}, select, h('small', {}, from)),
        ]),
      ),
      said.length > 0 && h('ul', 'lnotes', ...said.map(([text, warn]) => h('li', warn ? 'lwarn' : '', text))),
    ]);
  };

  const summary = (): LocaleSummary => {
    ask();
    const now = inUse();
    const differs =
      !!geo?.country &&
      (now.country !== geo.country.code ||
        (!!geo.currency && now.currency !== geo.currency) ||
        (!!geo.language && now.language !== baseLang(geo.language)));
    return { text: joined([now.country, now.currency, now.language]), differs };
  };

  return {
    view: () => {
      const { text } = summary();
      return [
        h('div', 'vhead', h('span', {}, h('b', {}, 'Locale'), text && ` · ${text}`)),
        h('div', 'lgrid', visitor(), settings()),
      ];
    },
    summary,
  };
}
