import type { Blocked } from '../../engine/tracking';
import type { NextConfig } from '../legacy/globals';
import { NAMES } from '.';

const blockedEvents = (provider: 'gtm' | 'facebook' | 'rudderstack'): string[] => {
  const list = (window as { nextConfig?: NextConfig }).nextConfig?.analytics?.providers?.[provider]?.blockedEvents;
  return Array.isArray(list) ? list.filter((name): name is string => typeof name === 'string') : [];
};

const blockedTracking = (names: string[]): Blocked | undefined => {
  const entries = Object.entries(NAMES).filter(([, dl]) => names.includes(dl));
  return entries.length ? (Object.fromEntries(entries) as Blocked) : undefined;
};

/**
 * @deprecated 0.4.x `analytics.providers.<gtm|facebook|rudderstack>.blockedEvents`: `dl_*` names, matched
 * verbatim, each kept from that one destination. Meta and RudderStack leave out the tracking event the name
 * is pushed for. Filter in your own tag or `next.analytics.on('*', fn)` instead.
 */
export function legacyBlocked() {
  const gtm = blockedEvents('gtm');
  return {
    dataLayer: gtm.length ? gtm : undefined,
    meta: blockedTracking(blockedEvents('facebook')),
    rudderstack: blockedTracking(blockedEvents('rudderstack')),
  };
}
