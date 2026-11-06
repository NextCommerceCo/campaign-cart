import { I18N_RULES } from './texts';
import type { Send } from './types';

/** What i18n-rules' `/v1/geo` says about the visitor, without the address and coordinates. */
export interface VisitorGeo {
  country: { code: string; name: string } | null;
  currency: string | null;
  /** The browser's first `Accept-Language`, `th-TH`. */
  language: string | null;
  region: string | null;
  timezone: string | null;
  /** `default` when the edge resolved no country: a local request, or a Tor exit. */
  source: 'cf' | 'default';
}

type GeoAnswer = Omit<VisitorGeo, 'region'> & { region: { name: string } | null };

let asked: Promise<VisitorGeo | undefined> | undefined;

/** The visitor's geo, asked once per page; `undefined` when i18n-rules cannot answer. */
export function visitorGeo(send: Send, lang = 'en', base = I18N_RULES): Promise<VisitorGeo | undefined> {
  asked ??= send(`${base}/v1/geo?lang=${encodeURIComponent(lang)}`, { method: 'GET' })
    .then(async (res) => {
      if (!res.ok) return undefined;
      const geo = (await res.json()) as GeoAnswer;
      return {
        country: geo.country,
        currency: geo.currency,
        language: geo.language,
        region: geo.region?.name ?? null,
        timezone: geo.timezone,
        source: geo.source,
      };
    })
    .catch(() => undefined);
  return asked;
}
