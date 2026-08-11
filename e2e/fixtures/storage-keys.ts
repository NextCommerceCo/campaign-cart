/**
 * The scope literal below is the FNV-1a hash of the fixtures' shared
 * `next-api-key`. If it ever needs recomputing, the one spec that asserts a derived
 * key (`storage-scope.spec.ts`) fails first and names the value the SDK actually
 * produced.
 *
 * Cart, checkout, order, prospect-cart, timer and exit-intent keys carry a
 * `__{scope}` suffix so two campaigns on one origin cannot read each other's copy
 * (`src/core/storage-scope.ts`). A spec that seeds or reads one of those entries has
 * to spell the suffix, and this is the single place that knows what it is.
 *
 * Every fixture declares the same `next-api-key` and is served from
 * `/e2e/fixtures/…`, so both halves of the derived scope — the key hash and the
 * first path segment, `e2e` — are identical for all of them however deeply they
 * nest. `storage-scope.spec.ts` holds the exceptions: two fixtures that declare a
 * scope outright, two that carry different API keys, and two served at a URL of the
 * spec's choosing so there is more than one base path to test against.
 */
export const FIXTURE_STORAGE_SCOPE = '1k56lj4-e2e';

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
