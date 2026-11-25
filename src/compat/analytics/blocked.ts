import type { Skip } from '../../engine/tracking';
import { nextConfig } from '../legacy/globals';
import { BLOCKED, NAMES } from '.';

const blockedEvents = (provider: 'gtm' | 'facebook' | 'rudderstack'): string[] => {
  const list = nextConfig().analytics?.providers?.[provider]?.blockedEvents;
  return Array.isArray(list) ? list.filter((name): name is string => typeof name === 'string') : [];
};

const skipBlocked = (names: string[]): Skip | undefined =>
  names.length
    ? ({ event_type }) => (names.includes(NAMES[event_type]) ? { name: NAMES[event_type], reason: BLOCKED } : undefined)
    : undefined;

/**
 * @deprecated 0.4.x `analytics.providers.<gtm|facebook|rudderstack>.blockedEvents`: `dl_*` names, matched
 * verbatim, each kept from that one destination. Meta and RudderStack leave out the tracking event the name
 * is pushed for. Filter in your own tag or `next.analytics.on('*', fn)` instead.
 */
export function legacyBlocked() {
  const gtm = blockedEvents('gtm');
  return {
    dataLayer: gtm.length ? gtm : undefined,
    meta: skipBlocked(blockedEvents('facebook')),
    rudderstack: skipBlocked(blockedEvents('rudderstack')),
  };
}
