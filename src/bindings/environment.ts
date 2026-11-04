import { withoutQuery } from '../engine/attribution';
import type { Environment } from '../engine/engine';

export function pageEnvironment(): Environment {
  return {
    page_location: location.origin + location.pathname,
    page_title: document.title,
    page_referrer: withoutQuery(document.referrer),
    browser: {
      user_agent: navigator.userAgent,
      language: navigator.language,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      screen: { width: screen.width, height: screen.height },
      viewport: { width: innerWidth, height: innerHeight },
      device_type: matchMedia('(pointer: coarse)').matches ? 'mobile' : 'desktop',
    },
  };
}
