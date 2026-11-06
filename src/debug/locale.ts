import type { Engine } from '../engine/engine';
import { localeOf } from '../engine/format';
import { askGeo, type VisitorGeo, visitorGeo } from '../engine/geo';
import { baseLang, I18N_RULES } from '../engine/texts';
import type { Send } from '../engine/types';
import type { DebugActions } from './state';
import { type IconName, icon } from './icons';
import { type Child, h } from './view';

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

/** A pill over the panel: an icon and the code in use, with the native select laid over it. */
const pill = (
  glyph: IconName,
  label: string,
  options: Option[],
  value: string | undefined,
  [note, warn]: Note,
  onchange: (code: string) => void,
) => {
  const known = !value || options.some(([code]) => code === value);
  const list: Option[] = [...(known ? [] : [[value, value] as Option]), ...options];
  if (!list.length) list.push(['', '—']);
  const select = h(
    'select',
    { disabled: list.length < 2, onchange: () => onchange(select.value) },
    ...list.map(([code, name]) => h('option', { value: code }, name)),
  );
  select.setAttribute('aria-label', `${label}: ${note}`);
  select.value = value ?? '';
  const el = h(
    'label',
    { className: 'lpill', title: `${label} · ${note}` },
    icon(glyph),
    h('span', {}, value ? value.toUpperCase() : '—'),
    warn && h('span', 'mdot'),
    icon('chevron'),
    select,
  );
  if (warn) el.dataset.warn = '';
  return el;
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

export interface LocaleSummary {
  /** `US · EUR · en`: the country, currency and language in use. */
  text: string;
  /** Geo answered and one of them is not what geo found. */
  differs: boolean;
}

export interface LocaleTab {
  /** The globe's popover: where the visitor is, from geo. */
  view(): Child[];
  summary(): LocaleSummary;
  /** Country, currency and language in use, a switch each, marked when they differ from geo. */
  switchers(): Child[];
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
    void engine
      .attach((ctx) => visitorGeo(ctx, () => askGeo(send, language())))
      .then((found) => {
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

  const flag = (code: string, className: string) =>
    h('img', { className, alt: '', src: `${I18N_RULES}/v1/flags/${code.toLowerCase()}.svg` });

  const where = (): Child => {
    if (!answered) return h('div', 'lwhere', h('span', 'dim', 'Asking where the visitor is…'));
    if (!geo?.country)
      return h(
        'div',
        'lwhere',
        h(
          'span',
          geo ? 'dim' : 'lwarn',
          geo
            ? 'The edge resolved no country: a local request or a Tor exit'
            : "The address service didn't answer; reload to ask again",
        ),
      );
    const g = geo;
    return h(
      'div',
      'lwhere',
      flag(g.country!.code, 'lflag'),
      h('b', {}, g.country!.name),
      h('span', 'dim', joined([g.city, g.timezone && localTime(g.timezone).split(' · ')[1]])),
    );
  };

  const details = (): Child => {
    if (!geo) return null;
    const g = geo;
    const rows: Array<[string, Child]> = [
      ['Region', joined([g.state?.name, g.region?.subregion?.name ?? g.region?.name])],
      ['Postcode', g.postcode],
      ['Time zone', g.timezone && localTime(g.timezone)],
      [
        'Coordinates',
        typeof g.latitude === 'number' && typeof g.longitude === 'number' && mapLink(g.latitude, g.longitude),
      ],
      ['Currency', g.currency],
      ['Browser language', g.language],
      ['IP', g.ip],
      ['Source', g.source === 'cf' ? 'Cloudflare edge' : 'No country resolved'],
    ];
    return h('dl', 'lrows', ...rows.filter(([, v]) => v).flatMap(([k, v]) => [h('dt', {}, k), h('dd', {}, v)]));
  };

  /** One line under a setting: how it compares with the visitor, and where the value in use comes from. */
  const notes = (now: ReturnType<typeof inUse>): Record<'country' | 'currency' | 'language', Note> => {
    const country = geo?.country;
    const offered = (now.state.campaign?.available_currencies ?? []).some((c) => c.code === geo?.currency);
    const asks = geo?.language ? baseLang(geo.language) : undefined;
    const opens = now.shipping.find(([c]) => c === 'US') ?? now.shipping[0];
    return {
      country: !country
        ? [now.countryFrom]
        : now.shipping.length && !now.shipping.some(([c]) => c === country.code)
          ? [`${country.name} isn't a shipping country: the checkout opens on ${opens?.[1]}`, true]
          : country.code === now.country
            ? [`Matches the visitor · ${now.countryFrom}`]
            : [`Visitor is in ${country.name} · ${now.countryFrom}`, true],
      currency: !geo?.currency
        ? [`${now.currencyFrom} · changing reloads`]
        : geo.currency === now.currency
          ? [`Matches the visitor · ${now.currencyFrom} · changing reloads`]
          : offered
            ? [`Visitor's is ${geo.currency}: a link with ?currency=${geo.currency} · changing reloads`, true]
            : [`Visitor's is ${geo.currency}, not one this campaign sells in · changing reloads`, true],
      language: !asks
        ? [`${now.languageFrom} · changing reloads`]
        : asks === now.language
          ? [`Matches the browser (${geo!.language}) · changing reloads`]
          : [
              `Browser asks ${geo!.language}${LANGUAGES[asks] ? '' : ', no texts in it'} · changing reloads`,
              !!LANGUAGES[asks],
            ],
    };
  };

  const switchers = (): Child[] => {
    ask();
    const now = inUse();
    const said = notes(now);
    const currencies = (now.state.campaign?.available_currencies ?? []).map((c): Option => [c.code, c.label]);
    return [
      pill('mapPin', 'Country', now.shipping, now.country, said.country, setCountry),
      pill('banknote', 'Currency', currencies, now.currency, said.currency, (c) => reload('currency', c)),
      pill('languages', 'Language', Object.entries(LANGUAGES), now.language, said.language, (c) => reload('lang', c)),
    ];
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

  return { view: () => [where(), details()], summary, switchers };
}
