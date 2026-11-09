import { withoutQuery } from '../engine/visit/attribution';
import type { Environment } from '../engine/engine';

export function pageEnvironment(): Environment {
  return {
    page_location: location.origin + location.pathname,
    page_title: document.title,
    page_referrer: withoutQuery(document.referrer),
    browser: {
      user_agent: navigator.userAgent,
      language: navigator.language,
      device_type: matchMedia('(pointer: coarse)').matches ? 'mobile' : 'desktop',
    },
  };
}
