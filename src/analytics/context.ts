import type { Engine } from '../engine/engine';
import type { AnalyticsContext } from '../engine/types';

const withoutQuery = (url: string) => {
  try {
    const u = new URL(url);
    return u.origin + u.pathname;
  } catch {
    return '';
  }
};

export function pageContext(engine: Engine): AnalyticsContext {
  const { campaign } = engine.getState();
  const attribution = engine.attribution();
  const metadata = Object.fromEntries(
    Object.entries(attribution.metadata).map(([k, v]) => [
      k,
      typeof v === 'string' && /^https?:/.test(v) ? withoutQuery(v) : v,
    ]),
  );
  return {
    page_location: location.origin + location.pathname,
    page_title: document.title,
    page_referrer: withoutQuery(document.referrer),
    campaign_name: campaign?.name,
    campaign_currency: campaign?.currency,
    campaign_language: campaign?.language,
    attribution: { ...attribution, metadata },
  };
}

export function eventIds(): () => string {
  const page = Math.random().toString(36).slice(2, 10);
  let seq = 0;
  return () => `${page}_${++seq}`;
}
