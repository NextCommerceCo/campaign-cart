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
 * cannot edit, so the scope falls back to the one thing every working page already
 * carries and every page of a funnel carries identically: the API key it boots with.
 * A page that *does* name its funnel gets that in the scope too, which is what
 * separates two funnels running one campaign. There is no multi-campaign detection
 * and there could not be one — a page cannot know what else shares its origin.
 * Scoping is unconditional instead, and on a single-campaign origin the suffix is
 * simply constant.
 */

/** The meta tag that overrides the derived scope, for a page you control. */
export const STORAGE_SCOPE_META = 'next-storage-scope';

/** The meta tag the API key is read from, the same one the config store uses. */
const API_KEY_META = 'next-api-key';

/**
 * The tags a funnel name can arrive on, matching what `AttributionCollector` accepts:
 * the plain `next-funnel`, and the two tracking-tag forms that carry it as
 * `data-tag-value` on a `funnel_name` tag. `querySelector` returns whichever comes
 * first in the document, which is the collector's behaviour too.
 */
const FUNNEL_META_SELECTOR =
  'meta[name="next-funnel"],' +
  'meta[name="os-tracking-tag"][data-tag-name="funnel_name"],' +
  'meta[name="data-next-tracking-tag"][data-tag-name="funnel_name"]';

/** Prefix of the key a resolved scope is remembered under. See {@link rememberScope}. */
const SCOPE_POINTER_PREFIX = 'next-storage-scope_';

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
 * The funnel half of the scope, read from the page's own tag and from nothing else.
 *
 * `AttributionCollector.getFunnelName` resolves the *reported* funnel through a
 * longer chain — `?funnel=` first, then a name remembered from an earlier campaign in
 * `next_funnel_name`, and only then this tag. Neither of those two may reach a storage
 * key. `next_funnel_name` lives in localStorage and is never scoped, so a name left
 * behind by another campaign would decide this one's cart key; and `?funnel=` is on
 * the landing URL but not on the link to the checkout, so the scope would change on
 * the way and empty the cart. Both are reporting inputs, not identity.
 *
 * The consequence to hold on to: the funnel a page *reports* and the funnel its
 * storage is *scoped by* can differ, and the scope is the tag every time.
 */
function funnelToken(): string {
  const tag = document.querySelector(FUNNEL_META_SELECTOR);
  // A tracking tag carries the value in `data-tag-value`, `next-funnel` in `content`.
  // An empty one of either has to fall through to the other, so `||`, not `??`.
  const tagged = tag?.getAttribute('data-tag-value') ?? '';
  const content = tag?.getAttribute('content') ?? '';

  return sanitize(tagged || content);
}

function pointerKey(campaign: string): string {
  return `${SCOPE_POINTER_PREFIX}${campaign}`;
}

/**
 * Remembers the scope a tagged page resolved to, so a page of the same funnel that
 * omits the funnel tag inherits it instead of minting a second scope and stranding
 * the cart. Keyed by the campaign token, so it can only ever be read back by a page
 * booting with the same API key.
 *
 * In sessionStorage, matching the lifetime of the cart, checkout and order it exists
 * to protect: a new tab derives from the tag again rather than from a decision made
 * in a tab that is gone.
 */
function rememberScope(campaign: string, scope: string): void {
  try {
    if (sessionStorage.getItem(pointerKey(campaign)) !== scope) {
      sessionStorage.setItem(pointerKey(campaign), scope);
    }
  } catch {
    // Storage blocked. Costs the inherit-on-missing-tag path, nothing else.
  }
}

function rememberedScope(campaign: string): string {
  try {
    return sanitize(sessionStorage.getItem(pointerKey(campaign)) ?? '');
  } catch {
    return '';
  }
}

/**
 * The scope every funnel-scoped storage key is suffixed with.
 *
 * Resolution order, first match wins:
 *
 * 1. `window.nextConfig.storageScope`
 * 2. `<meta name="next-storage-scope">`
 * 3. the API key and the page's funnel tag, joined — the automatic case
 * 4. the API key alone, when the page names no funnel
 * 5. `root`, when no key is readable
 *
 * Steps 3 and 4 are one campaign token with an optional funnel token after it. The
 * campaign token is what separates two campaigns, and it carries the whole job on a
 * page that names no funnel — which is every page the SDK does not own, since
 * campaigns run on customer domains. The funnel token is what separates two funnels
 * running the *same* campaign key, the one case a campaign token cannot see.
 *
 * A page inside a tagged funnel that omits the tag inherits the funnel's scope
 * rather than minting a second one; see {@link rememberScope}.
 *
 * **The URL is not part of it, and must not become part of it.** A funnel is spread
 * across sibling directories in production — `/apollo-presell/` and
 * `/apollo-checkout/` are two pages of one campaign — so every path-derived token
 * that has been tried here changed between the offer page and the checkout and
 * emptied the cart on the way. First path segment, directory, both: all wrong for
 * that layout, and none of them are wrong in a way a page can report. What the
 * funnel tag has and a path token never did is that an author states it, once, with
 * the same value on every page of the funnel whatever its URL.
 *
 * **Read once, at import.** The keys built from this are `persist` names captured
 * when their store module is created. `<script type="module">` is deferred, so the
 * whole `<head>` is parsed first and every meta tag is readable; a UMD bundle placed
 * *above* the API-key tag is the one case that misses it, and
 * {@link storageScopeFellBack} reports it. A funnel tag below the bundle is missed
 * the same way and reported the same way, because the pointer this writes is what
 * the later pages read.
 *
 * @example
 * ```ts
 * // Every page of one campaign that names no funnel, whatever its URL
 * // /apollo-presell/, /apollo-checkout/, /apollo-upsell1/
 * storageScope(); // 'kn3mmo' — the same on all three
 *
 * // A different campaign on the same origin
 * storageScope(); // '1k56lj4'
 *
 * // <meta name="next-funnel" content="apollo"> on every page of that funnel
 * storageScope(); // 'kn3mmo-apollo'
 *
 * // A second funnel on the same campaign key, tagged 'zeus'
 * storageScope(); // 'kn3mmo-zeus'
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

  const funnel = funnelToken();
  if (!funnel) return rememberedScope(campaign) || campaign;

  const scope = sanitize(`${campaign}-${funnel}`);
  rememberScope(campaign, scope);
  return scope;
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
