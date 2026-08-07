/**
 * Cart, checkout, order, prospect-cart, timer and exit-intent keys carry a
 * `__{scope}` suffix so two campaigns on one origin cannot read each other's copy
 * (`src/core/storage-scope.ts`). A spec that seeds or reads one of those entries has
 * to spell the suffix, and this is the single place that knows what it is.
 *
 * Every fixture is served from `/e2e/fixtures/<name>.html`, so the SDK derives the
 * scope from the first path segment and lands on `e2e` for all of them. The two
 * fixtures in `storage-scope.spec.ts` are the exception: they declare a scope with
 * `<meta name="next-storage-scope">` precisely so there is more than one.
 */
export const FIXTURE_STORAGE_SCOPE = 'e2e';

/** The key the SDK actually writes on a fixture page, for a given base name. */
export function scopedKey(
  base: string,
  scope: string = FIXTURE_STORAGE_SCOPE
): string {
  return `${base}__${scope}`;
}

export const ORDER_KEY = scopedKey('next-order');
export const CHECKOUT_KEY = scopedKey('next-checkout-store');
export const CART_KEY = scopedKey('next-cart-state');
