/**
 * One origin hosts many campaigns. On `my-campaigns.pages.dev` a shopper can move
 * between `/funnel-a/checkout` and `/promo-b.html` without ever leaving the origin,
 * and sessionStorage does not care which funnel wrote what — so a single
 * `next-cart-state` key means funnel B rehydrates funnel A's packages, vouchers and
 * shipping method. The voucher is the expensive one: an `AppliedCoupon` carries the
 * `DiscountDefinition` it matched, so funnel B applies a discount rule it never
 * declared.
 *
 * Every funnel-scoped key is therefore suffixed with the scope resolved here. Keys
 * that describe the *visitor* rather than the funnel — analytics session ids,
 * `visitor_id`, the purchase-dedup list, country reference data — are deliberately
 * left origin-wide; see `core/guide/reference/storage-keys.md`.
 */

/** The meta tag that names a funnel's storage scope explicitly. */
export const STORAGE_SCOPE_META = 'next-storage-scope';

/** Keeps a key readable in devtools while it cannot collide with the `__` join. */
const MAX_SCOPE_LENGTH = 40;

/** What a page at the origin root, or with an unusable scope, is called. */
const ROOT_SCOPE = 'root';

function sanitize(raw: string): string {
  return raw
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .slice(0, MAX_SCOPE_LENGTH)
    .replace(/^-+|-+$/g, '');
}

/**
 * An explicit scope wins over anything derived. It is the only thing that works for
 * a funnel spread across flat files (`/promo-b.html`, `/promo-b-checkout.html`),
 * where the first path segment differs on every page and deriving would empty the
 * cart between the offer and the checkout.
 */
function declaredScope(): string | undefined {
  const configured = (
    window as unknown as { nextConfig?: { storageScope?: unknown } }
  ).nextConfig?.storageScope;
  if (typeof configured === 'string' && sanitize(configured)) {
    return sanitize(configured);
  }

  const meta = document.querySelector(`meta[name="${STORAGE_SCOPE_META}"]`);
  const declared = meta?.getAttribute('content') ?? '';
  return sanitize(declared) || undefined;
}

/**
 * The scope every funnel-scoped storage key is suffixed with: the value of
 * `window.nextConfig.storageScope` or `<meta name="next-storage-scope">` when either
 * is set, and the first path segment otherwise.
 *
 * The first segment — not the full pathname — because a funnel spans several pages
 * (`/funnel-a/`, `/funnel-a/checkout`, `/funnel-a/receipt`) and the cart has to
 * survive across them. A page at the origin root resolves to `root`.
 *
 * **Read once, at import.** The keys built from this are `persist` names captured
 * when their store module is created, so a `<meta name="next-storage-scope">` tag
 * has to be parsed before the SDK script runs — put it in `<head>` above the loader.
 * A tag added later is read by nothing.
 *
 * @example
 * ```ts
 * // On https://my-campaigns.pages.dev/funnel-a/checkout
 * storageScope(); // 'funnel-a'
 *
 * // With <meta name="next-storage-scope" content="promo-b"> on any URL
 * storageScope(); // 'promo-b'
 * ```
 */
export function storageScope(): string {
  const declared = declaredScope();
  if (declared) return declared;

  const [firstSegment = ''] = window.location.pathname
    .split('/')
    .filter(Boolean);
  return sanitize(firstSegment) || ROOT_SCOPE;
}
