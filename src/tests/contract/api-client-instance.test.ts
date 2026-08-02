import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { getApiClient, resetApiClient } from '@/client';
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
});
