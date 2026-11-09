import { I18N_RULES } from '../display/texts';
import type { Context } from '../engine';
import type { Send } from '../types';

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

const asking = new WeakMap<object, Promise<VisitorGeo | undefined>>();

/** Asks i18n-rules' `/v1/geo` directly; `undefined` when it cannot answer. */
export function askGeo(send: Send, lang = 'en', base = I18N_RULES): Promise<VisitorGeo | undefined> {
  return send(`${base}/v1/geo?lang=${encodeURIComponent(lang)}`, { method: 'GET' })
    .then(async (res) => (res.ok ? ((await res.json()) as VisitorGeo) : undefined))
    .catch(() => undefined);
}

/** The visitor's geo, asked once per tab and kept with the visit in session storage. */
export function visitorGeo(
  ctx: Pick<Context, 'getState' | 'update'>,
  ask: () => Promise<VisitorGeo | undefined>,
): Promise<VisitorGeo | undefined> {
  const kept = ctx.getState().visit.geo;
  if (kept) return Promise.resolve(kept);
  let asked = asking.get(ctx);
  if (!asked) {
    asked = ask().then((geo) => {
      if (geo) ctx.update('visit', { geo });
      return geo;
    });
    asking.set(ctx, asked);
  }
  return asked;
}
