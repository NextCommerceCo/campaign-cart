import type { EventAttribution } from '../events/context';
import type { Cookies } from '../runtime/session';

declare const __VERSION__: string;

export const withoutQuery = (url: string) => {
  try {
    const u = new URL(url);
    return u.origin + u.pathname;
  } catch {
    return '';
  }
};

export interface Visit {
  landingPage: string;
  referrer: string;
  device: string;
  deviceType: 'mobile' | 'desktop';
  fbp?: string;
  fbc?: string;
  domain?: string;
  pixelId?: string;
}

export interface Attribution {
  affiliate?: string;
  funnel?: string;
  gclid?: string;
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
  utm_content?: string;
  utm_term?: string;
  subaffiliate1?: string;
  subaffiliate2?: string;
  subaffiliate3?: string;
  subaffiliate4?: string;
  subaffiliate5?: string;
  everflow_transaction_id?: string;
  metadata: Record<string, string | number>;
}

const CLICK_IDS = ['fbclid', 'clickid', 'ttclid', 'msclkid', 'gbraid', 'wbraid'];

/** The platform's limit for one metadata value, in code points; an order with a longer one is refused. */
const METADATA_MAX = 2000;
const capped = (value: string | number) =>
  typeof value === 'string' ? [...value].slice(0, METADATA_MAX).join('') : value;

/**
 * `metadata` is what the page set with `setMetadata`: its keys come after the SDK's own, so the page's value is the
 * one sent. The Everflow id is the page's, else `?evclid`, else `storedEvclid` (0.4.x `localStorage.evclid`).
 */
export function buildAttribution(
  {
    params,
    landing: visit,
    geo,
    metadata,
  }: {
    params: Record<string, string>;
    landing?: Visit;
    geo?: { ip: string | null };
    metadata?: Record<string, string | number>;
  },
  funnel: string | undefined,
  now: number,
  cookies?: Pick<Cookies, 'get'>,
  storedEvclid?: string | null,
): Attribution {
  const pick = (...keys: string[]) => keys.map((k) => params[k]).find(Boolean);
  const sub = (n: number) => pick(`subaffiliate${n}`, `sub${n}`)?.slice(0, 225);
  const evclid = String(metadata?.everflow_transaction_id || params.evclid || storedEvclid || '');
  const result: Attribution = {
    affiliate: pick('affid', 'aff'),
    funnel: params.funnel || funnel,
    gclid: params.gclid,
    utm_source: params.utm_source,
    utm_medium: params.utm_medium,
    utm_campaign: params.utm_campaign,
    utm_content: params.utm_content,
    utm_term: params.utm_term,
    subaffiliate1: sub(1),
    subaffiliate2: sub(2),
    subaffiliate3: sub(3),
    subaffiliate4: sub(4),
    subaffiliate5: sub(5),
    everflow_transaction_id: evclid,
    metadata: Object.fromEntries(
      Object.entries({
        landing_page: visit?.landingPage ?? '',
        referrer: visit?.referrer ?? '',
        device: visit?.device ?? '',
        device_type: visit?.deviceType ?? 'desktop',
        fb_fbp: cookies?.get('_fbp') || visit?.fbp || '',
        fb_fbc: cookies?.get('_fbc') || visit?.fbc || '',
        domain: visit?.domain ?? '',
        fb_pixel_id: visit?.pixelId ?? '',
        sdk_version: __VERSION__,
        conversion_timestamp: now,
        ...(geo?.ip && { user_ip: geo.ip }),
        ...Object.fromEntries(CLICK_IDS.filter((k) => params[k]).map((k) => [k, params[k]!])),
        ...metadata,
        ...(evclid && { everflow_transaction_id: evclid }),
      }).map(([key, value]) => [key, capped(value)]),
    ),
  };
  return Object.fromEntries(
    Object.entries(result).filter(([, v]) => v !== undefined && v !== ''),
  ) as unknown as Attribution;
}

export function eventAttribution({ metadata, ...fields }: Attribution): EventAttribution {
  const text = (key: string) => (typeof metadata[key] === 'string' ? (metadata[key] as string) : '');
  const added = {
    landing_page: withoutQuery(text('landing_page')),
    fbclid: text('fbclid'),
    fbp: text('fb_fbp'),
    fbc: text('fb_fbc'),
    clickid: text('clickid'),
  };
  return { ...fields, ...Object.fromEntries(Object.entries(added).filter(([, v]) => v)) };
}
