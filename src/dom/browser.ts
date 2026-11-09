import type { EngineOptions } from '../engine/engine';

export const browserStorage = (get: () => Storage): Storage | null => {
  try {
    return get();
  } catch {
    return null;
  }
};

const cookie = (name: string) => document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`))?.[1];

const pixelId = () =>
  document.querySelector<HTMLMetaElement>('meta[name="os-facebook-pixel"], meta[name="facebook-pixel-id"]')?.content ||
  [...document.scripts].map((s) => s.text.match(/fbq\s*\(\s*['"]init['"],\s*['"](\d+)['"]/)?.[1]).find(Boolean);

/** What the Engine reads from the browser: its storage, cookies and this visit. */
export const browserOptions = (): Pick<EngineOptions, 'storage' | 'cookies' | 'visit'> => ({
  storage: { local: browserStorage(() => localStorage), session: browserStorage(() => sessionStorage) },
  cookies: {
    get: cookie,
    set: (name, value, days) => {
      document.cookie = `${name}=${value}; path=/; max-age=${days * 86400}; SameSite=Lax`;
    },
  },
  visit: {
    landingPage: location.href,
    referrer: document.referrer,
    device: navigator.userAgent,
    deviceType: matchMedia('(pointer: coarse)').matches ? 'mobile' : 'desktop',
    fbp: cookie('_fbp'),
    fbc: cookie('_fbc'),
    domain: location.hostname,
    pixelId: pixelId(),
  },
});
