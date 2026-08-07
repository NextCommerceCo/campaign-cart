/**
 * One origin hosts many campaigns. On `my-campaigns.pages.dev` a shopper can move
 * between `/funnel-a/checkout` and `/promo-b.html` without ever leaving the origin,
 * and sessionStorage does not care which funnel wrote what — so a single
 * `next-cart-state` key means funnel B rehydrates funnel A's cart. The voucher is
 * the expensive one: an `AppliedCoupon` carries the `DiscountDefinition` it matched,
 * so funnel B applies a discount rule it never declared.
 *
 * Every funnel-scoped key is therefore suffixed with the scope resolved here. Keys
 * that describe the *visitor* rather than the funnel — analytics session ids,
 * `visitor_id`, the purchase-dedup list, country reference data — are deliberately
 * left origin-wide; see `core/guide/reference/storage-keys.md`.
 *
 * **Nothing is asked of the page.** Campaigns run on customer domains the SDK cannot
 * edit, so the scope is derived from the one thing every working page already
 * carries and every page of a funnel carries identically: the API key it boots with.
 * There is no multi-campaign detection and there could not be one — a page cannot
 * know what else shares its origin. Scoping is unconditional instead, and on a
 * single-campaign origin the suffix is simply constant.
 */

/** The meta tag that overrides the derived scope, for a page you control. */
export const STORAGE_SCOPE_META = 'next-storage-scope';

/** The meta tag the API key is read from, the same one the config store uses. */
const API_KEY_META = 'next-api-key';

/**
 * FNV-1a, 32-bit. The API key is hashed rather than truncated because keys issued
 * to one account share a prefix — `test-e2e-key-xxxxx` and `test-e2e-key-yyyyy`
 * agree on their first thirteen characters, and a prefix token would have filed two
 * campaigns under one scope. Sync by necessity: this runs at module scope, where
 * `crypto.subtle` (a promise) cannot.
 */
function hashToken(value: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < value.length; i++) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(36);
}

/** Keeps a key readable in devtools while it cannot collide with the `__` join. */
const MAX_SCOPE_LENGTH = 40;

/** What a page with no readable API key falls back to. See {@link storageScopeFellBack}. */
const ROOT_SCOPE = 'root';

function sanitize(raw: string): string {
  return raw
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .slice(0, MAX_SCOPE_LENGTH)
    .replace(/^-+|-+$/g, '');
}

function metaContent(name: string): string {
  return (
    document.querySelector(`meta[name="${name}"]`)?.getAttribute('content') ??
    ''
  );
}

function windowConfig(): Record<string, unknown> | undefined {
  return (window as unknown as { nextConfig?: Record<string, unknown> })
    .nextConfig;
}

/**
 * An explicit scope wins over anything derived. Only useful on a page you can edit —
 * `my-campaigns.pages.dev`, where two funnels may share one campaign key and still
 * want separate carts.
 */
function declaredScope(): string | undefined {
  const configured = windowConfig()?.storageScope;
  if (typeof configured === 'string' && sanitize(configured)) {
    return sanitize(configured);
  }
  return sanitize(metaContent(STORAGE_SCOPE_META)) || undefined;
}

/**
 * The campaign half of the scope. Read straight from the DOM rather than from the
 * config store, because the store is populated in `loadConfiguration` — long after
 * the persisted stores captured their key names.
 */
function apiKeyToken(): string {
  const fromWindow = windowConfig()?.apiKey;
  const apiKey =
    typeof fromWindow === 'string' && fromWindow
      ? fromWindow
      : metaContent(API_KEY_META);

  return apiKey ? hashToken(apiKey) : '';
}

/**
 * The scope every funnel-scoped storage key is suffixed with.
 *
 * Resolution order, first match wins:
 *
 * 1. `window.nextConfig.storageScope`
 * 2. `<meta name="next-storage-scope">`
 * 3. a hash of the API key — the automatic case
 * 4. `root`, when no key is readable
 *
 * **The URL is not part of it, and must not become part of it.** A funnel is spread
 * across sibling directories in production — `/apollo-presell/` and
 * `/apollo-checkout/` are two pages of one campaign — so every path-derived token
 * that has been tried here changed between the offer page and the checkout and
 * emptied the cart on the way. First path segment, directory, both: all wrong for
 * that layout, and none of them are wrong in a way a page can report. The API key
 * is the only thing that is identical on every page of a funnel and different
 * between campaigns.
 *
 * The cost is the converse case: two *different* funnels running the same campaign
 * key at one origin share a cart. They also share a catalog and a discount table,
 * so a carried cart still prices correctly — and where that is not wanted, the page
 * is one you control and can declare a scope on.
 *
 * **Read once, at import.** The keys built from this are `persist` names captured
 * when their store module is created. `<script type="module">` is deferred, so the
 * whole `<head>` is parsed first and both meta tags are readable; a UMD bundle
 * placed *above* the API-key tag is the one case that misses it, and
 * {@link storageScopeFellBack} reports it.
 *
 * @example
 * ```ts
 * // Every page of one campaign, whatever its URL
 * // /apollo-presell/, /apollo-checkout/, /apollo-upsell1/
 * storageScope(); // 'kn3mmo' — the same on all three
 *
 * // A different campaign on the same origin
 * storageScope(); // '1k56lj4'
 *
 * // <meta name="next-storage-scope" content="promo-b"> overrides the derivation
 * storageScope(); // 'promo-b'
 * ```
 */
export function storageScope(): string {
  return declaredScope() ?? (apiKeyToken() || ROOT_SCOPE);
}

/**
 * True when no API key was readable at import even though one *was* configured, so
 * every funnel-scoped key on this page fell back to {@link ROOT_SCOPE}.
 *
 * That fallback is deliberately the shared scope rather than anything derived from
 * the URL: it degrades to the behaviour from before scoping existed — every campaign
 * on the origin sharing one cart — which is a known state, rather than to a scope
 * that differs per page and empties the cart mid-funnel.
 *
 * Takes the configured key rather than reading it, so the caller can ask this only
 * once `loadConfiguration` has established that a key exists at all. The message
 * belongs to the caller: the generated log reference is built from literals, and a
 * string returned from here would be invisible to it.
 */
export function storageScopeFellBack(configuredApiKey: string): boolean {
  return Boolean(configuredApiKey) && !declaredScope() && !apiKeyToken();
}
