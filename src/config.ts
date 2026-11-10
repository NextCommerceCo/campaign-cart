import { legacyApiKey, legacyFlags, legacyFunnel } from './compat/config';

export const API_BASE = 'https://campaigns.apps.29next.com';

export interface BootConfig {
  apiKey: string;
  apiBase: string;
  funnel: string;
  currency?: string;
  lang?: string;
  debug?: boolean;
  reset: boolean;
}

const scriptAttr = (doc: Document, name: string) => doc.querySelector(`script[${name}]`)?.getAttribute(name) ?? '';

export function readConfig(doc: Document, win: Window): BootConfig {
  const params = new URLSearchParams(win.location.search);
  const legacy = legacyFlags(params);
  const debug = params.get('debug');
  return {
    apiKey: scriptAttr(doc, 'data-campaign') || legacyApiKey(doc, win),
    apiBase: API_BASE,
    funnel: scriptAttr(doc, 'data-funnel') || legacyFunnel(doc, win),
    currency: params.get('currency') || undefined,
    lang: params.get('lang') || undefined,
    debug: debug === '1' || legacy.debug ? true : debug === '0' ? false : undefined,
    reset: params.get('reset') === '1' || legacy.reset,
  };
}

export function campaignUrl(base: string, currency?: string): string {
  return `${base}/api/v1/campaigns/${currency ? `?currency=${encodeURIComponent(currency)}` : ''}`;
}

/**
 * The chunk files a parsed page will import after boot, to fetch beside it: `map` is the build's
 * `name:file,file|name:file` list of each lazy chunk with the chunks it imports.
 */
export function pagePreloads(map: string, doc: Document, search: string): string[] {
  const v2 = doc.querySelector('[data-next-selector],[data-next-option],[data-next-query]');
  const names = [
    v2 ? 'attributes' : 'legacy',
    doc.querySelector('form[data-next-checkout]') && 'checkout',
    doc.querySelector('[data-next-cart-summary],[data-next-discounts]') && 'cart-summary',
    doc.querySelector('[data-next-bundle-slot-template-id],[data-next-bundle-slot-template]') && 'slots',
    /[?&](order_)?ref_id=/.test(search) && 'order',
  ];
  const files = map.split('|').flatMap((entry) => {
    const [name, list] = entry.split(':');
    return names.includes(name!) && list ? list.split(',') : [];
  });
  return [...new Set(files)];
}
