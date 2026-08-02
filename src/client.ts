/**
 * Composition root — where the SDK's shared dependencies are built.
 *
 * Today it owns exactly one: the campaign API client. Before this file existed, every
 * place that needed the API ran `new ApiClient(useConfigStore.getState().apiKey)`, so a
 * single page ended up with a dozen clients that differed in nothing — same base URL,
 * same key, same logger. {@link getApiClient} hands out one instead.
 *
 * See the `sdk-structure` skill §6 for where this is heading: features receive their
 * dependencies rather than constructing them, and this is the file that will do the
 * handing over.
 *
 * @module
 */

import { ApiClient } from '@/api/client';
import type { IApiClient } from '@/api/client.types';
import { useConfigStore } from '@/state/config';

let instance: IApiClient | undefined;
let instanceKey: string | undefined;

/**
 * The shared {@link IApiClient} for this page.
 *
 * Returns the same instance on every call. A new one is built only when the API key
 * differs from the key the current instance was built with — which happens once in
 * practice, on the first call after `SDKInitializer` has read the key from the
 * `next-api-key` meta tag or `window.nextConfig`.
 *
 * Sharing is safe because {@link ApiClient} carries no per-caller state: it holds a base
 * URL, the key, and a logger, and every method is a one-shot `fetch`. There is no cache,
 * no in-flight map, and no abort controller inside it — an `AbortSignal` is passed in per
 * call by the caller that owns it.
 *
 * @param apiKey Use a specific key instead of the configured one. Callers that already
 *   hold the key (the campaign and cart state layers receive it as an argument) pass it
 *   here rather than re-reading the config store.
 *
 * @example
 * ```ts
 * import { getApiClient } from '@/client';
 *
 * const order = await getApiClient().getOrder('ORD-1234');
 * ```
 *
 * @example
 * ```ts
 * // A caller that was handed the key explicitly.
 * const campaign = await getApiClient(apiKey).getCampaigns('USD');
 * ```
 */
export function getApiClient(apiKey?: string): IApiClient {
  const key = apiKey ?? useConfigStore.getState().apiKey;

  if (!instance || instanceKey !== key) {
    instance = new ApiClient(key);
    instanceKey = key;
  }

  return instance;
}

/**
 * Drops the memoized client so the next {@link getApiClient} call builds a fresh one.
 *
 * For tests that need to observe construction, or that swap the configured key between
 * cases. Production code has no reason to call it.
 *
 * @internal
 */
export function resetApiClient(): void {
  instance = undefined;
  instanceKey = undefined;
}
