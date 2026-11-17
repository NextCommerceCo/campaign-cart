import { legacyApiKey, legacyAutoCurrency, legacyFlags, legacyFunnel } from './compat/config';

export const API_BASE = 'https://campaigns.apps.29next.com';
const GEO = 'https://i18n-rules.nextcommerce.com/v1/geo';
const VISITOR_CURRENCY = 'next:visitor-currency';
const GEO_TIMEOUT = 1500;

export interface BootConfig {
  apiKey: string;
  apiBase: string;
  funnel: string;
  currency?: string;
  /** `data-currency="auto"` without `?currency=`: the campaign is asked for the visitor's currency. */
  autoCurrency?: boolean;
  lang?: string;
  debug?: boolean;
  reset: boolean;
}

const scriptAttr = (doc: Document, name: string) => doc.querySelector(`script[${name}]`)?.getAttribute(name) ?? '';

export function readConfig(doc: Document, win: Window): BootConfig {
  const params = new URLSearchParams(win.location.search);
  const legacy = legacyFlags(params);
  const debug = params.get('debug');
  const currency = params.get('currency') || undefined;
  return {
    apiKey: scriptAttr(doc, 'data-campaign') || legacyApiKey(doc, win),
    apiBase: API_BASE,
    funnel: scriptAttr(doc, 'data-funnel') || legacyFunnel(doc, win),
    currency,
    autoCurrency: !currency && (scriptAttr(doc, 'data-currency') === 'auto' || legacyAutoCurrency(win)),
    lang: params.get('lang') || undefined,
    debug: debug === '1' || legacy.debug ? true : debug === '0' ? false : undefined,
    reset: params.get('reset') === '1' || legacy.reset,
  };
}

/**
 * The currency of the visitor's country, as i18n-rules' `/v1/geo` resolves it: asked once per tab, and none
 * when it does not answer within `timeout`. The campaign falls back to its own currency for one it does not sell in.
 */
export async function visitorCurrency(win: Window, timeout = GEO_TIMEOUT): Promise<string | undefined> {
  try {
    const kept = win.sessionStorage.getItem(VISITOR_CURRENCY);
    if (kept !== null) return kept || undefined;
  } catch {}
  const abort = new AbortController();
  const timer = setTimeout(() => abort.abort(), timeout);
  try {
    const res = await win.fetch(GEO, { signal: abort.signal });
    if (!res.ok) return undefined;
    const currency = ((await res.json()) as { currency?: string | null }).currency ?? '';
    try {
      win.sessionStorage.setItem(VISITOR_CURRENCY, currency);
    } catch {}
    return currency || undefined;
  } catch {
    return undefined;
  } finally {
    clearTimeout(timer);
  }
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
