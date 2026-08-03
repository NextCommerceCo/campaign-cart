import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { getApiClient, resetApiClient } from '@/client';
import { ApiClient } from '@/api/client';
import { useConfigStore } from '@/state/config';

/**
 * One API client per page.
 *
 * Twelve places used to run `new ApiClient(useConfigStore.getState().apiKey)`, so a page
 * carried a dozen clients that differed in nothing. `src/client.ts` is now the only
 * construction site, and this asserts the two properties every caller relies on:
 * repeated calls hand back the *same object*, and a changed key does not leave callers
 * authenticating with the old one.
 *
 * A unit test rather than a whole-repo scan, but it belongs with the contracts: the thing
 * it protects is a repo-wide invariant, not one feature's behaviour.
 */
describe('contract: the shared API client', () => {
  const originalKey = useConfigStore.getState().apiKey;

  beforeEach(() => {
    resetApiClient();
    useConfigStore.setState({ apiKey: 'key-one' });
  });

  afterEach(() => {
    resetApiClient();
    useConfigStore.setState({ apiKey: originalKey });
  });

  it('returns the same instance on every call', () => {
    expect(getApiClient()).toBe(getApiClient());
  });

  it('defaults its key from the config store', () => {
    expect(getApiClient().getApiKey()).toBe('key-one');
  });

  it('reuses the instance when an explicit key matches the current one', () => {
    const first = getApiClient('key-one');
    expect(getApiClient('key-one')).toBe(first);
  });

  it('builds a new instance when the key changes', () => {
    const first = getApiClient();

    useConfigStore.setState({ apiKey: 'key-two' });
    const second = getApiClient();

    expect(second).not.toBe(first);
    expect(second.getApiKey()).toBe('key-two');
  });

  /**
   * `resetApiClient` is the only escape hatch, and it exists for this file's own
   * `beforeEach`. Nothing in `src/` outside the tests imports it and `src/index.ts` does
   * not re-export it, so production code cannot reach it — but a test that calls it must
   * really drop the instance, or the *next* test in the same file inherits a client built
   * from the previous test's config.
   */
  it('resetApiClient drops the instance so the next call builds a fresh one', () => {
    const first = getApiClient();

    resetApiClient();

    expect(getApiClient()).not.toBe(first);
  });

  /**
   * The memo cannot disagree with the instance it memoizes.
   *
   * `ApiClient.setApiKey` is public and the class is exported from `src/index.ts`, so the
   * shared instance can be re-keyed from outside this module. When `client.ts` kept its
   * own copy of the key, that copy went stale: the next `getApiClient('key-one')` matched
   * the *remembered* key and handed back a client that was by then authenticating with
   * something else — every caller silently using the wrong credentials. The memo now reads
   * the key off the instance, so there is no second copy that can drift.
   *
   * The cast is the point of the test: `setApiKey` is deliberately not on `IApiClient`
   * (see `api-surface.test.ts`), so reaching it takes the concrete class.
   */
  it('does not hand back a client that was re-keyed behind its back', () => {
    const first = getApiClient('key-one');
    (first as ApiClient).setApiKey('rogue-key');

    const second = getApiClient('key-one');

    expect(second.getApiKey()).toBe('key-one');
    expect(second).not.toBe(first);
  });
});
