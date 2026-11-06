import { I18N_RULES, rulesSend } from './texts';
import type { Send } from './types';

/** i18n-rules' `/v1/geo`: where the visitor is, as the edge resolved it. */
export interface VisitorGeo {
  ip: string | null;
  country: { code: string; name: string } | null;
  state: { code: string | null; name: string } | null;
  city: string | null;
  postcode: string | null;
  timezone: string | null;
  latitude: number | null;
  longitude: number | null;
  /** The browser's first `Accept-Language`, `th-TH`. */
  language: string | null;
  currency: string | null;
  region: { code: string; name: string; subregion?: { code: string; name: string } | null } | null;
  /** `default` when the edge resolved no country: a local request, or a Tor exit. */
  source: 'cf' | 'default';
}

let asked: Promise<VisitorGeo | undefined> | undefined;

/** The visitor's geo, asked once per page and kept in memory only; `undefined` when i18n-rules cannot answer. */
export function visitorGeo(send: Send, lang = 'en', base = I18N_RULES): Promise<VisitorGeo | undefined> {
  asked ??= rulesSend(send)(`${base}/v1/geo?lang=${encodeURIComponent(lang)}`, { method: 'GET' })
    .then(async (res) => (res.ok ? ((await res.json()) as VisitorGeo) : undefined))
    .catch(() => undefined);
  return asked;
}
