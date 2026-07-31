import { describe, it, expect } from 'vitest';

// `src/index.ts` auto-initializes the SDK on import when the DOM is ready.
// Force `readyState = 'loading'` BEFORE importing so it only registers a
// `DOMContentLoaded` listener (which we never fire) instead of booting — this
// test asserts the export surface, not runtime behavior.
Object.defineProperty(document, 'readyState', {
  configurable: true,
  get: () => 'loading',
});

/**
 * Public API contract.
 *
 * Locks the runtime export surface of `src/index.ts` — the frozen public API
 * consumers depend on. This test must stay green through every step of the
 * structure refactor: moving/renaming internal files may NOT change what
 * `index.ts` exports. If a move breaks this, the move is wrong.
 *
 * (Type-only exports — `export type * from './types/global'` — are erased at
 * runtime and cannot be asserted here; they are covered by `type-check`.)
 */
describe('public API contract (src/index.ts)', () => {
  it('exports the expected runtime surface', async () => {
    const SDK = await import('../../index');

    // Classes / services
    expect(typeof SDK.NextCommerce).toBe('function');
    expect(typeof SDK.SDKInitializer).toBe('function');
    expect(typeof SDK.Logger).toBe('function');
    expect(typeof SDK.EventBus).toBe('function');
    expect(typeof SDK.ApiClient).toBe('function');

    // Store hooks
    expect(typeof SDK.useCartStore).toBe('function');
    expect(typeof SDK.useCampaignStore).toBe('function');
    expect(typeof SDK.useConfigStore).toBe('function');
    expect(typeof SDK.useCheckoutStore).toBe('function');
    expect(typeof SDK.useOrderStore).toBe('function');

    // Version constant
    expect(typeof SDK.VERSION).toBe('string');
  });

  it('does not accidentally add or drop named exports', async () => {
    const SDK = await import('../../index');
    const actual = Object.keys(SDK).sort();

    // The full runtime export list. Update this ONLY as a deliberate,
    // approved public-API change — never as a side effect of a refactor.
    const expected = [
      'ApiClient',
      'EventBus',
      'Logger',
      'NextCommerce',
      'SDKInitializer',
      'VERSION',
      'useCampaignStore',
      'useCartStore',
      'useCheckoutStore',
      'useConfigStore',
      'useOrderStore',
    ].sort();

    expect(actual).toEqual(expected);
  });
});
