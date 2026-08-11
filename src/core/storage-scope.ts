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
 * **Nothing is required of the page.** Campaigns run on customer domains the SDK
 * cannot edit, so both halves of the scope are read from what a working page already
 * has: the API key it boots with, and the folder it is served from. There is no
 * multi-campaign detection and there could not be one — a page cannot know what else
 * shares its origin. Scoping is unconditional instead, and on a single-campaign
 * origin the suffix is simply constant.
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
 * The base-path half of the scope: the **first path segment**, and only on a page
 * that sits inside one.
 *
 * `/hu/earbuds`, `/hu/earbuds/checkout` and `/hu/earbuds/upsell1` all yield `hu` —
 * the token is the top folder, so it does not move as a shopper walks deeper into a
 * funnel. A page at the top level yields nothing: `/presell` and `/checkout` are
 * siblings at the root with no folder between them, and taking `presell` there would
 * change the scope on the way to the checkout. That is the shape of the two designs
 * that shipped and were pulled — see {@link storageScope}.
 *
 * The rule is therefore about **depth, not spelling**: one segment means no base, two
 * or more means the first one. The trap that leaves is a funnel that mixes the two —
 * a landing page at `/hu/` and a checkout at `/hu/checkout` resolve differently, and
 * nothing on either page can report that.
 */
function basePathToken(): string {
  const segments = window.location.pathname.split('/').filter(Boolean);

  return segments.length >= 2 ? sanitize(segments[0] ?? '') : '';
}

/**
 * The scope every funnel-scoped storage key is suffixed with.
 *
 * Resolution order, first match wins:
 *
 * 1. `window.nextConfig.storageScope`
 * 2. `<meta name="next-storage-scope">`
 * 3. the API key and the first path segment, joined — the automatic case
 * 4. the API key alone, on a page at the top level with no folder above it
 * 5. `root`, when no key is readable
 *
 * Steps 3 and 4 are one campaign token with an optional base-path token after it.
 * The campaign token is what separates two campaigns and requires nothing of the
 * page, which matters because campaigns run on customer domains the SDK cannot edit.
 * The base-path token separates two funnels running the *same* campaign key from
 * different top folders — the one case a campaign token cannot see, because to it
 * those pages are identical.
 *
 * **Only the first segment, and only above the root.** A funnel spans several pages
 * and the token has to be identical on all of them. Two narrower path tokens shipped
 * here and were pulled: the *directory*, which differs between `/apollo-presell/` and
 * `/apollo-checkout/`, and the *first segment counted at any depth*, which does the
 * same for those two. Taking the first segment only when there is a folder above the
 * page keeps `/hu/earbuds` and `/hu/earbuds/checkout` together on `hu` and leaves
 * root-level siblings sharing the campaign token, which is what those two got wrong.
 *
 * What it cannot cover is a funnel that **mixes depths** — a landing page at `/hu/`
 * and a checkout at `/hu/checkout` are one segment and two, so they resolve to
 * different scopes and the cart does not survive the walk. Nothing on either page can
 * report that, so a funnel laid out that way has to declare a scope outright.
 *
 * **Read once, at import.** The keys built from this are `persist` names captured
 * when their store module is created. `<script type="module">` is deferred, so the
 * whole `<head>` is parsed first and both meta tags are readable; a UMD bundle placed
 * *above* the API-key tag is the one case that misses it, and
 * {@link storageScopeFellBack} reports it.
 *
 * @example
 * ```ts
 * // Every page under one top folder, at any depth below it
 * // /hu/earbuds, /hu/earbuds/checkout, /hu/earbuds/upsell1
 * storageScope(); // 'kn3mmo-hu' — the same on all three
 *
 * // The same campaign key served from a different top folder
 * // /de/earbuds
 * storageScope(); // 'kn3mmo-de'
 *
 * // Root-level siblings: no folder above them, so the campaign token alone
 * // /apollo-presell/, /apollo-checkout/
 * storageScope(); // 'kn3mmo' — the same on both
 *
 * // <meta name="next-storage-scope" content="promo-b"> overrides the derivation
 * storageScope(); // 'promo-b'
 * ```
 */
export function storageScope(): string {
  const declared = declaredScope();
  if (declared) return declared;

  const campaign = apiKeyToken();
  if (!campaign) return ROOT_SCOPE;

  const base = basePathToken();

  return base ? sanitize(`${campaign}-${base}`) : campaign;
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
