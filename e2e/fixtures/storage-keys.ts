/**
 * The scope literals below are FNV-1a hashes of the fixtures' `next-api-key` and the
 * first path segment they are served under, hashed together with a `\n` between them
 * (`src/core/storage-scope.ts`). They are written out rather than recomputed here on
 * purpose: a test that re-derives its expectation from the same algorithm passes
 * whatever that algorithm does. If one ever needs recomputing, `storage-scope.spec.ts`
 * fails first and names the value the SDK actually produced.
 *
 * Cart, checkout, order, prospect-cart, timer and exit-intent keys carry a
 * `__{scope}` suffix so two campaigns on one origin cannot read each other's copy. A
 * spec that seeds or reads one of those entries has to spell the suffix, and this is
 * the single place that knows what it is.
 *
 * Every fixture declares the same `next-api-key` and Vite serves them all from
 * `/e2e/fixtures/…`, so every fixture reached by its real URL resolves to the same
 * scope, however deeply it nests. `storage-scope.spec.ts` holds the exceptions: two
 * fixtures that declare a scope outright, two that carry different API keys, and
 * several served at a URL of the spec's choosing so there is more than one base path
 * to test against.
 */
export const FIXTURE_STORAGE_SCOPE = '1q9gah0';

/**
 * What the same fixture resolves to when it is served from the top level, where there
 * is no folder above the page for the second half of the hash.
 */
export const ROOT_LEVEL_SCOPE = '5gdkqm';

/**
 * The key the SDK actually writes on a fixture page, for a given base name. An empty
 * scope yields the bare name — that is the shape on a page whose API key was not
 * readable, and it has to be spellable here for the same reason the others do.
 */
export function scopedKey(
  base: string,
  scope: string = FIXTURE_STORAGE_SCOPE
): string {
  return scope ? `${base}__${scope}` : base;
}

export const ORDER_KEY = scopedKey('next-order');
export const CHECKOUT_KEY = scopedKey('next-checkout-store');
export const CART_KEY = scopedKey('next-cart-state');
