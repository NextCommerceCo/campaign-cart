import { type Attribution, buildAttribution, eventAttribution, type Visit } from '../engine/attribution';
import { isAttributionParam, trackingIgnored } from '../engine/params';
import { plural } from './view';

export type From = 'landing' | 'page' | 'earlier' | 'cookie' | 'visit';
export type Group = 'campaign' | 'click' | 'affiliate' | 'visit';

export interface SourceParam {
  key: string;
  value: string;
  group: Group;
  from: From;
  /** The landing URL's value, when a later page replaced it. */
  was?: string;
  note?: string;
  order: boolean;
  events: boolean;
}

export interface SourceStep {
  label: string;
  detail: string;
  tone: 'done' | 'warn' | 'off';
}

export interface Source {
  headline: string;
  platforms: string[];
  params: SourceParam[];
  unset: string[];
  steps: SourceStep[];
  ignored: boolean;
}

export interface SourceInput {
  params: Record<string, string>;
  landing?: Visit;
  current: string;
  attribution: Attribution;
  cookies: { fbc?: string; fbp?: string };
}

const GROUPS: Array<[Group, RegExp]> = [
  ['campaign', /^utm_\w+$/],
  ['click', /^(gclid|gbraid|wbraid|fbclid|ttclid|msclkid|clickid|evclid)$/],
  ['affiliate', /^(affid|aff|sub\d|subaffiliate\d)$/],
];
const UTMS = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term'];
const PLATFORMS: Array<[RegExp, string]> = [
  [/^(gclid|gbraid|wbraid)$/, 'Google Ads'],
  [/^(fbclid|_fbc)$/, 'Meta'],
  [/^ttclid$/, 'TikTok'],
  [/^msclkid$/, 'Microsoft Ads'],
  [/^evclid$/, 'Everflow'],
];

type Flat = Record<string, unknown>;
const onOrder = ({ metadata, ...fields }: Attribution): Flat => ({ ...metadata, ...fields });
const onEvents = (a: Attribution): Flat => ({ ...eventAttribution(a) });
const built = (params: Record<string, string>) => buildAttribution({ params }, undefined, 0);

const groupOf = (key: string) => GROUPS.find(([, test]) => test.test(key))?.[0];
const parse = (url = '') => {
  try {
    return new URL(url);
  } catch {
    return undefined;
  }
};
const query = (url?: string) => parse(url)?.searchParams ?? new URLSearchParams();
const host = (url?: string) => parse(url)?.hostname ?? '';
const path = (url?: string) => parse(url)?.pathname ?? '';

/** Whether `key=value` fills a field of `shape` that the real attribution holds with the same value. */
const reaches = (key: string, value: string, shape: (a: Attribution) => Flat, real: Flat) => {
  const empty = shape(built({}));
  return Object.entries(shape(built({ [key]: value }))).some(([f, v]) => v !== empty[f] && real[f] === v);
};

export function readSource({ params, landing, current, attribution, cookies }: SourceInput): Source {
  const order = onOrder(attribution);
  const events = onEvents(attribution);
  const landed = query(landing?.landingPage);
  const here = query(current);

  const fromUrl = Object.entries(params).flatMap(([key, value]): SourceParam[] => {
    const group = groupOf(key);
    if (!group || !isAttributionParam(key)) return [];
    const was = landed.get(key) ?? undefined;
    return [
      {
        key,
        value,
        group,
        from: was === value ? 'landing' : here.get(key) === value ? 'page' : 'earlier',
        ...(was !== undefined && was !== value && { was }),
        order: reaches(key, value, onOrder, order),
        events: reaches(key, value, onEvents, events),
      },
    ];
  });

  const fromCookies = (['fbc', 'fbp'] as const).flatMap((name): SourceParam[] => {
    const read = landing?.[name];
    const value = read || cookies[name];
    if (!value) return [];
    return [
      {
        key: `_${name}`,
        value,
        group: 'click',
        from: 'cookie',
        ...(!read && { note: 'Set after the landing page read it' }),
        order: order[`fb_${name}`] === value,
        events: events[name] === value,
      },
    ];
  });

  const visit: SourceParam[] = (
    [
      ['landing', path(landing?.landingPage), 'landing_page'],
      ['referrer', host(landing?.referrer), 'referrer'],
      ['funnel', attribution.funnel ?? '', 'funnel'],
    ] as const
  )
    .filter(([, value]) => value)
    .map(([key, value, field]) => ({
      key,
      value,
      group: 'visit',
      from: 'visit',
      order: !!order[field],
      events: !!events[field],
    }));

  const rows = [...fromUrl, ...fromCookies, ...visit];
  const carried = fromUrl;
  const captured = [...landed.keys()].filter((k) => groupOf(k));
  const lost = captured.filter((k) => !(k in params));
  const notHere = carried.filter((r) => !here.has(r.key)).map((r) => r.key);
  const notRecorded = rows.filter((r) => !r.order).map((r) => r.key);

  const referrer = host(landing?.referrer);
  const source = attribution.utm_source || referrer || 'direct';
  const medium = attribution.utm_medium || (referrer ? 'referral' : 'none');
  const affiliate = attribution.affiliate && `Affiliate ${attribution.affiliate}`;

  return {
    headline: `${source} / ${medium}${attribution.utm_campaign ? ` · ${attribution.utm_campaign}` : ''}`,
    platforms: [
      ...new Set([
        ...rows.flatMap((r) => PLATFORMS.filter(([test]) => test.test(r.key)).map(([, name]) => name)),
        ...(affiliate ? [affiliate] : []),
      ]),
    ],
    params: rows,
    unset: UTMS.filter((k) => !(k in params)),
    ignored: trackingIgnored(params),
    steps: [
      captured.length
        ? {
            label: 'Captured',
            detail: `${plural(captured.length, 'param')} on ${path(landing?.landingPage)}`,
            tone: 'done',
          }
        : { label: 'Captured', detail: 'None on the landing URL', tone: 'off' },
      lost.length
        ? { label: 'Kept', detail: `Lost ${lost.join(', ')}`, tone: 'warn' }
        : carried.length
          ? { label: 'Kept', detail: `${plural(carried.length, 'param')} in this tab`, tone: 'done' }
          : { label: 'Kept', detail: 'Nothing to keep', tone: 'off' },
      notHere.length
        ? { label: 'Carried', detail: `Not on this URL: ${notHere.join(', ')}`, tone: 'warn' }
        : carried.length
          ? { label: 'Carried', detail: "On this page's URL", tone: 'done' }
          : { label: 'Carried', detail: 'Nothing to carry', tone: 'off' },
      notRecorded.length
        ? { label: 'On the order', detail: `Not recorded: ${notRecorded.join(', ')}`, tone: 'warn' }
        : { label: 'On the order', detail: 'All recorded', tone: 'done' },
    ],
  };
}

/** What a link's params would become: on the order, carried on links only, or neither. */
export function checkLink(href: string) {
  const url = parse(href);
  if (!url) return undefined;
  const params = Object.fromEntries(url.searchParams);
  const order = onOrder(built(params));
  const keys = Object.keys(params);
  const recorded = (k: string) => reaches(k, params[k]!, onOrder, order);
  return {
    order: keys.filter((k) => isAttributionParam(k) && recorded(k)),
    linksOnly: keys.filter((k) => isAttributionParam(k) && !recorded(k)),
    other: keys.filter((k) => !isAttributionParam(k)),
  };
}
