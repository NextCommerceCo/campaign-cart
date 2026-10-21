export interface Visit {
  landingPage: string;
  referrer: string;
  device: string;
  deviceType: 'mobile' | 'desktop';
  fbp?: string;
  fbc?: string;
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

export function buildAttribution(params: Record<string, string>, visit: Visit | undefined, funnel: string | undefined): Attribution {
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
      ...(params.fbclid && { fbclid: params.fbclid }),
      ...(params.clickid && { clickid: params.clickid }),
      ...(evclid && { everflow_transaction_id: evclid }),
    },
  };
  return Object.fromEntries(Object.entries(result).filter(([, v]) => v !== undefined && v !== '')) as unknown as Attribution;
}
