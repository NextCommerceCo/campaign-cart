import type { EventAttribution } from './events';

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

export function buildAttribution(
  params: Record<string, string>,
  visit: Visit | undefined,
  funnel: string | undefined,
  now: number,
): Attribution {
  const pick = (...keys: string[]) => keys.map((k) => params[k]).find(Boolean);
  const sub = (n: number) => pick(`subaffiliate${n}`, `sub${n}`)?.slice(0, 225);
  const evclid = params.evclid;
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
    metadata: {
      landing_page: visit?.landingPage ?? '',
      referrer: visit?.referrer ?? '',
      device: visit?.device ?? '',
      device_type: visit?.deviceType ?? 'desktop',
      fb_fbp: visit?.fbp ?? '',
      fb_fbc: visit?.fbc ?? '',
      domain: visit?.domain ?? '',
      fb_pixel_id: visit?.pixelId ?? '',
      sdk_version: __VERSION__,
      conversion_timestamp: now,
      ...(params.fbclid && { fbclid: params.fbclid }),
      ...(params.clickid && { clickid: params.clickid }),
      ...(evclid && { everflow_transaction_id: evclid }),
    },
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
