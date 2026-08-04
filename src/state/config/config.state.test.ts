import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { useConfigStore } from '@/state/config';

/**
 * `loadFromWindow()` reads whatever the page put on `window.nextConfig`, so every value it
 * accepts is attacker-adjacent in the mildest sense: a page author's typo. The `locale`
 * branch is the one where a typo would otherwise be fatal — `new Intl.NumberFormat('de_DE')`
 * throws, and the formatter runs on every price — so it is validated at the door.
 */

function setWindowConfig(config: Record<string, unknown>): void {
  (window as unknown as Record<string, unknown>).nextConfig = config;
}

beforeEach(() => {
  useConfigStore.setState({ locale: undefined });
});

afterEach(() => {
  delete (window as unknown as Record<string, unknown>).nextConfig;
  useConfigStore.setState({ locale: undefined });
  vi.restoreAllMocks();
});

describe('config store — locale', () => {
  it('accepts a well-formed BCP 47 tag', () => {
    setWindowConfig({ locale: 'de-DE' });

    useConfigStore.getState().loadFromWindow();

    expect(useConfigStore.getState().locale).toBe('de-DE');
  });

  it('canonicalises casing so `DE-de` and `de-DE` behave the same', () => {
    setWindowConfig({ locale: 'DE-de' });

    useConfigStore.getState().loadFromWindow();

    expect(useConfigStore.getState().locale).toBe('de-DE');
  });

  it('trims surrounding whitespace rather than rejecting the tag', () => {
    setWindowConfig({ locale: '  fr-FR  ' });

    useConfigStore.getState().loadFromWindow();

    expect(useConfigStore.getState().locale).toBe('fr-FR');
  });

  it.each(['de_DE', 'not a locale', '', '   ', 123, null])(
    'leaves the locale unset for the invalid value %p',
    invalid => {
      setWindowConfig({ locale: invalid });

      // The point of the guard: a bad tag must not throw here, and must not reach
      // Intl.NumberFormat, where it would throw on every price on the page.
      expect(() => useConfigStore.getState().loadFromWindow()).not.toThrow();
      expect(useConfigStore.getState().locale).toBeUndefined();
      expect(() => new Intl.NumberFormat(undefined)).not.toThrow();
    }
  );

  it('leaves the locale unset when the page does not mention it', () => {
    setWindowConfig({ apiKey: 'test-key' });

    useConfigStore.getState().loadFromWindow();

    expect(useConfigStore.getState().locale).toBeUndefined();
  });
});
