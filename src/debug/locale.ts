import type { Engine } from '../engine/engine';
import { localeOf } from '../engine/format';
import { type VisitorGeo, visitorGeo } from '../engine/geo';
import { baseLang } from '../engine/texts';
import type { Send } from '../engine/types';
import type { DebugActions } from './state';
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

const reload = (param: string, value: string) => {
  const url = new URL(location.href);
  url.searchParams.set(param, value);
  location.assign(url.href);
};

const row = (
  label: string,
  options: Array<[string, string]>,
  value: string | undefined,
  onchange: (code: string) => void,
  detected?: string,
): Child[] => {
  const known = !value || options.some(([code]) => code === value);
  const list: Array<[string, string]> = [...(known ? [] : [[value, value] as [string, string]]), ...options];
  if (!list.length) list.push(['', '—']);
  const select = h(
    'select',
    { className: 'select', disabled: list.length < 2, onchange: () => onchange(select.value) },
    ...list.map(([code, name]) => h('option', { value: code }, name)),
  );
  select.dataset.size = 'sm';
  select.setAttribute('aria-label', label);
  select.value = value ?? '';
  return [h('span', {}, label), h('div', {}, select, detected && h('small', {}, detected))];
};

export function localeMenu(engine: Engine, debug: DebugActions, send: Send, render: () => void) {
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

  const setCountry = (code: string) => {
    if (engine.checkout) return engine.checkout.setField('country', code);
    debug.setPanel({ country: code });
    render();
  };

  const status = () => {
    if (!answered) return 'Detecting…';
    if (!geo) return 'Geo unavailable';
    if (geo.source === 'default') return 'No geo on a local request';
    return geo.timezone ?? '';
  };

  return (): Child => {
    if (!asked) {
      asked = true;
      void visitorGeo(send, language()).then((found) => {
        geo = found;
        answered = true;
        render();
      });
    }
    const { campaign, checkout } = engine.getState();
    const form = engine.checkout && checkout;
    const waiting = !form && debug.state().panel.country;
    const countries: Array<[string, string]> = form?.countries.length
      ? form.countries.map((c) => [c.code, c.name])
      : (campaign?.available_shipping_countries ?? []).map((c) => [c.code, c.label]);
    const currencies = (campaign?.available_currencies ?? []).map((c): [string, string] => [c.code, c.label]);
    const detected = [geo?.country && `Geo: ${geo.country.name}`, waiting && 'applies at checkout'].filter(Boolean);
    return h(
      'div',
      'mloc',
      h('header', {}, h('h3', {}, 'Locale'), h('small', {}, status())),
      ...row(
        'Country',
        countries,
        form?.fields.country || waiting || geo?.country?.code,
        setCountry,
        detected.join(' · '),
      ),
      ...row(
        'Currency',
        currencies,
        campaign?.currency,
        (code) => reload('currency', code),
        geo?.currency ? `Geo: ${geo.currency}` : '',
      ),
      ...row(
        'Language',
        Object.entries(LANGUAGES),
        language(),
        (code) => reload('lang', code),
        geo?.language ? `Browser: ${geo.language}` : '',
      ),
    );
  };
}
