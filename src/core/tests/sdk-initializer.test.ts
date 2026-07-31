/**
 * Boot-failure handling in SDKInitializer.initialize() — findings #26, #30,
 * #41 in docs/code-findings.md.
 *
 * A missing API key throws inside loadCampaignData (boot step 5). Before the
 * fix this:
 *   - flipped `data-next-sdk-loading` to "false" on every failed attempt
 *     (#26/#41), un-hiding the page before window.next, the DOM scan, or
 *     next:display-ready ever ran;
 *   - never told the page a boot had failed at all (#26);
 *   - re-registered the attribution event/popstate listeners on every retry
 *     and every reinitialize() (#30), so a page that retried three times
 *     ended up with three sets of handlers.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { SDKInitializer } from '@/core/sdk-initializer';
import { useConfigStore } from '@/state/config';
import { useAttributionStore } from '@/state/attribution';
import { EventBus } from '@/core/events';
import type { CartState, ErrorData } from '@/types/global';

// SDKInitializer keeps all boot state on private static fields with no public
// reset, so tests reach past the type system to put it back to a fresh,
// un-booted state between runs.
type InitializerInternals = {
  initialized: boolean;
  retryAttempts: number;
  attributionListenersCleanup: (() => void) | null;
  setupAttributionListeners: () => void;
};
const internals = SDKInitializer as unknown as InitializerInternals;

function resetBootState(): void {
  internals.initialized = false;
  internals.retryAttempts = 0;
}

// EventBus is a singleton shared by every test in the process (see
// core/tests/events.test.ts) — clear it before each test here too, or a
// listener registered by one test's full `initialize()` retries (each of
// which calls setupAttributionListeners()) leaks into the next test's count.
beforeEach(() => {
  EventBus.getInstance().removeAllListeners();
});

// The retry path recurses through the real 1s/2s/3s backoff and several
// dynamic imports (attribution collector, parameter store) up to 3 times.
// Fake timers plus those dynamic imports deadlock under this vitest/vite-node
// combination (a `runAllTimersAsync()` that never settles, unrelated to the
// fix), so these two run on real timers with a budget past the ~6s the
// backoff needs on its own.
const RETRY_TEST_TIMEOUT = 15000;

describe('SDKInitializer boot failure (missing API key)', () => {
  beforeEach(() => {
    resetBootState();
    useConfigStore.getState().reset();
    // Skip the location/currency detection network path — irrelevant to
    // these findings and not something this test should have to mock.
    useConfigStore.getState().updateConfig({ currencyBehavior: 'manual' });
    document.body.removeAttribute('data-next-sdk-loading');
  });

  it(
    'finding #26/#41: never flips data-next-sdk-loading to "false" on a failing boot',
    async () => {
      const setAttributeSpy = vi.spyOn(document.body, 'setAttribute');

      await expect(SDKInitializer.initialize()).rejects.toThrow(
        'API key not found'
      );

      const loadingValues = setAttributeSpy.mock.calls
        .filter(([name]) => name === 'data-next-sdk-loading')
        .map(([, value]) => value);

      // Pre-fix this was ['true', 'false', 'true', 'false', 'true', 'false',
      // 'true', 'false'] — one true/false cycle per attempt, un-hiding the page
      // mid-retry (#41) and after the final failure (#26).
      expect(loadingValues).not.toContain('false');
      expect(document.body.getAttribute('data-next-sdk-loading')).toBe('true');
    },
    RETRY_TEST_TIMEOUT
  );

  it(
    'finding #26: surfaces the permanent failure through error:occurred',
    async () => {
      const handler = vi.fn((_data: ErrorData) => {});
      EventBus.getInstance().on('error:occurred', handler);

      await expect(SDKInitializer.initialize()).rejects.toThrow(
        'API key not found'
      );

      expect(handler).toHaveBeenCalledTimes(1);
      const [payload] = handler.mock.calls[0] ?? [];
      expect(payload?.code).toBe('SDK_INIT_FAILED');
      expect(payload?.message).toContain('API key not found');
    },
    RETRY_TEST_TIMEOUT
  );
});

describe('SDKInitializer.setupAttributionListeners idempotence (finding #30)', () => {
  beforeEach(() => {
    internals.attributionListenersCleanup?.();
    internals.attributionListenersCleanup = null;
  });

  it('does not stack a second cart:updated handler when called again, as a retry or reinitialize() would', () => {
    const updateAttributionSpy = vi.spyOn(
      useAttributionStore.getState(),
      'updateAttribution'
    );

    // Simulates what a failed-boot retry does today: initializeAttribution()
    // — and this call inside it — reruns from the top on every attempt.
    internals.setupAttributionListeners();
    internals.setupAttributionListeners();

    EventBus.getInstance().emit('cart:updated', {} as unknown as CartState);

    expect(updateAttributionSpy).toHaveBeenCalledTimes(1);
  });

  it('does not stack a second popstate listener on window', () => {
    const addSpy = vi.spyOn(window, 'addEventListener');
    const removeSpy = vi.spyOn(window, 'removeEventListener');

    internals.setupAttributionListeners();
    internals.setupAttributionListeners();

    const popstateAdds = addSpy.mock.calls.filter(
      ([type]) => type === 'popstate'
    );
    const popstateRemoves = removeSpy.mock.calls.filter(
      ([type]) => type === 'popstate'
    );

    // Two registrations, but the second call must remove the first before
    // adding its own — net one live listener.
    expect(popstateAdds).toHaveLength(2);
    expect(popstateRemoves).toHaveLength(1);
  });
});
