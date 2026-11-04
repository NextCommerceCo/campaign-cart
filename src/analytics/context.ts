import type { Engine } from '../engine/engine';
import type { AnalyticsContext } from '../engine/events';

const withoutQuery = (url: string) => {
  try {
    const u = new URL(url);
    return u.origin + u.pathname;
  } catch {
    return '';
  }
};

export function pageContext(engine: Engine): AnalyticsContext {
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
    campaign: engine.eventCampaign(),
    attribution: { ...attribution, metadata },
    session_id: engine.sessionId(),
  };
}
