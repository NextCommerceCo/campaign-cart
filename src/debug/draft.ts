import { LOADER_KEYS, type PageConfig } from '../engine/debug-config';
import type { ConfigSection } from './config';
import { plural } from './view';

export type Obj = Record<string, unknown>;

export interface Field {
  path: string;
  label: string;
  kind: 'switch' | 'text' | 'locale' | 'view';
  fallback?: boolean;
  placeholder?: string;
  summary?: (value: unknown) => string;
}

const isObj = (v: unknown): v is Obj => !!v && typeof v === 'object' && !Array.isArray(v);

export const get = (o: unknown, path: string) =>
  path.split('.').reduce<unknown>((v, k) => (isObj(v) ? v[k] : undefined), o);

export function put(o: Obj, path: string, value: unknown) {
  const keys = path.split('.');
  const last = keys.pop()!;
  let at = o;
  for (const k of keys) at = (isObj(at[k]) ? at[k] : (at[k] = {})) as Obj;
  if (value === undefined) delete at[last];
  else at[last] = value;
}

export const clone = (v: unknown): unknown =>
  Array.isArray(v) ? v.map(clone) : isObj(v) ? Object.fromEntries(Object.entries(v).map(([k, x]) => [k, clone(x)])) : v;

export const short = (v: unknown): string =>
  typeof v === 'function'
    ? 'function'
    : Array.isArray(v)
      ? v.map((x) => (isObj(x) && typeof x.code === 'string' ? x.code : short(x))).join(', ')
      : isObj(v)
        ? Object.entries(v)
            .map(([k, x]) => `${k}: ${isObj(x) ? `{${Object.keys(x).join(', ')}}` : short(x)}`)
            .join(' · ')
        : String(v);

const texts = (v: unknown): number => (isObj(v) ? Object.values(v).reduce<number>((n, x) => n + texts(x), 0) : 1);

const toggle = (path: string, label: string, fallback: boolean): Field => ({ path, label, kind: 'switch', fallback });
const view = (path: string, label: string, summary?: Field['summary']): Field => ({
  path,
  label,
  kind: 'view',
  summary,
});

export const SECTIONS: Array<[ConfigSection, string, Field[]]> = [
  [
    'analytics',
    'Analytics',
    [
      toggle('analytics.enabled', 'Analytics', true),
      toggle('analytics.destinations.gtm.enabled', 'Google Tag Manager', true),
      toggle('analytics.destinations.ga4.enabled', 'Google Analytics 4', false),
      toggle('analytics.destinations.meta.enabled', 'Meta pixel', false),
      { path: 'analytics.destinations.meta.storeName', label: 'Meta store name', kind: 'text', placeholder: 'Not set' },
      toggle('analytics.destinations.rudderstack.enabled', 'RudderStack', false),
      toggle('analytics.providers.nextCampaign.enabled', 'NEXT analytics', true),
    ],
  ],
  [
    'language',
    'Language',
    [
      { path: 'locale', label: 'Language', kind: 'locale' },
      view('translations', 'Translations', (v) =>
        isObj(v) ? `${Object.keys(v).join(', ')} · ${plural(texts(v), 'text')}` : short(v),
      ),
    ],
  ],
  [
    'checkout',
    'Checkout',
    [
      toggle('addressConfig.enableAutocomplete', 'Address autocomplete', false),
      view('addressConfig.countries', 'Countries'),
      view('addressConfig.dontShowStates', 'Hidden states'),
      view('paymentConfig.expressCheckout', 'Express checkout'),
    ],
  ],
  ['page', 'Page', [{ path: 'pageType', label: 'Page type', kind: 'text', placeholder: 'product' }]],
];

const DEFAULTS = new Map(SECTIONS.flatMap(([, , fields]) => fields.map((f) => [f.path, f.fallback])));
export const LOADER = new Set<string>(LOADER_KEYS);
export const READ = new Set([
  'analytics',
  'storeName',
  'locale',
  'translations',
  'addressConfig',
  'paymentConfig',
  'pageType',
]);
export const SCRIPT_TAG: Record<string, string> = { apiKey: 'data-campaign', funnel: 'data-funnel' };
const LEGACY: Array<[from: string, to: string]> = [
  ['analytics.providers.gtm', 'analytics.destinations.gtm'],
  ['analytics.providers.facebook', 'analytics.destinations.meta'],
  ['analytics.providers.rudderstack', 'analytics.destinations.rudderstack'],
  ['storeName', 'analytics.destinations.meta.storeName'],
];

export const bare = (path: string) => path.replace(/^analytics\./, '').replace(/\.enabled$/, '');

export function normalize(config: PageConfig) {
  const draft = clone(Object.fromEntries(Object.entries(config).filter(([, v]) => v !== null))) as Obj;
  const converted: string[] = [];
  const legacy: Record<string, string> = {};
  for (const [from, to] of LEGACY) {
    const value = get(draft, from);
    if (value === undefined) continue;
    put(draft, from, undefined);
    converted.push(`${bare(from)} → ${bare(to)}`);
    const there = get(draft, to);
    if (isObj(value)) {
      for (const k of Object.keys(value)) if (!isObj(there) || !(k in there)) legacy[`${to}.${k}`] = bare(from);
      put(draft, to, { ...value, ...(isObj(there) ? there : {}) });
    } else if (there === undefined) {
      put(draft, to, value);
      legacy[to] = bare(from);
    }
  }
  return { draft, converted, legacy };
}

function compact(v: unknown, path = ''): unknown {
  if (!isObj(v)) return v;
  const out: Obj = {};
  for (const [k, x] of Object.entries(v)) {
    const at = path ? `${path}.${k}` : k;
    const value = compact(x, at);
    if (value === undefined || (isObj(value) && !Object.keys(value).length) || DEFAULTS.get(at) === value) continue;
    out[k] = value;
  }
  return out;
}

const IDENT = /^[A-Za-z_$][\w$]*$/;
const quote = (s: string) => `'${s.replace(/[\\']/g, '\\$&').replace(/\n/g, '\\n')}'`;

function literal(v: unknown, pad = ''): string {
  if (typeof v === 'string') return quote(v);
  const inner = `${pad}  `;
  if (Array.isArray(v)) {
    const items = v.map((x) => (typeof x === 'function' ? '/* function: keep yours */' : literal(x, inner)));
    const flat = `[${items.join(', ')}]`;
    return flat.length <= 72 && !flat.includes('\n')
      ? flat
      : `[\n${items.map((x) => `${inner}${x},`).join('\n')}\n${pad}]`;
  }
  if (isObj(v)) {
    const entries = Object.entries(v).map(([k, x]) => [IDENT.test(k) ? k : quote(k), x] as const);
    const leaf = entries.every(([, x]) => x === null || (typeof x !== 'object' && typeof x !== 'function'));
    const flat = `{ ${entries.map(([k, x]) => `${k}: ${literal(x)}`).join(', ')} }`;
    if (!entries.length) return '{}';
    if (pad && leaf && flat.length <= 60) return flat;
    const lines = entries.map(([k, x]) =>
      typeof x === 'function' ? `${inner}/* ${k}: function: keep yours */` : `${inner}${k}: ${literal(x, inner)},`,
    );
    return `{\n${lines.join('\n')}\n${pad}}`;
  }
  return String(v);
}

export const withoutLoader = (config: Obj) =>
  compact(Object.fromEntries(Object.entries(config).filter(([k]) => !LOADER.has(k)))) as Obj;
export const snippetOf = (config: Obj) => `window.nextConfig = ${literal(withoutLoader(config))};\n`;
