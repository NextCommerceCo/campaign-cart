import { describe, it, expect, beforeEach, afterAll } from 'vitest';

import {
  storageScope,
  storageScopeFellBack,
  STORAGE_SCOPE_META,
} from '@/core/storage-scope';

const originalLocation = Object.getOwnPropertyDescriptor(window, 'location');

const API_KEY = 'pk_7f2a9c1b3d4e';

function atPath(pathname: string): void {
  Object.defineProperty(window, 'location', {
    configurable: true,
    value: { pathname },
  });
}

function declareMeta(name: string, content: string): void {
  const meta = document.createElement('meta');
  meta.setAttribute('name', name);
  meta.setAttribute('content', content);
  document.head.appendChild(meta);
}

/** The automatic case: an API key on the page, no scope declared anywhere. */
function bootedWith(apiKey: string, pathname: string): string {
  document.head.innerHTML = '';
  declareMeta('next-api-key', apiKey);
  atPath(pathname);
  return storageScope();
}

describe('storageScope', () => {
  beforeEach(() => {
    document.head.innerHTML = '';
    delete (window as unknown as { nextConfig?: unknown }).nextConfig;
    atPath('/');
  });

  afterAll(() => {
    if (originalLocation) {
      Object.defineProperty(window, 'location', originalLocation);
    }
  });

  describe('derived with no help from the page', () => {
    it('combines the API key with the serving directory', () => {
      expect(bootedWith(API_KEY, '/funnel-a/checkout')).toMatch(
        /^[a-z0-9]+-funnel-a$/
      );
    });

    it('separates two keys that share a long prefix', () => {
      // The API key is hashed rather than truncated for exactly this: keys issued
      // to one account agree on their first several characters, and a prefix token
      // filed both campaigns under one scope.
      expect(bootedWith('test-e2e-key-xxxxx', '/checkout')).not.toBe(
        bootedWith('test-e2e-key-yyyyy', '/checkout')
      );
    });

    it('holds one scope across every page of a folder funnel', () => {
      const scopes = [
        '/funnel-a/',
        '/funnel-a/checkout',
        '/funnel-a/upsell1',
        '/funnel-a/receipt',
      ].map(path => bootedWith(API_KEY, path));

      expect(new Set(scopes).size).toBe(1);
    });

    it('holds one scope across a flat-file funnel too', () => {
      // The directory rather than the first path segment, precisely for this:
      // these are one funnel, and a scope that changed between them would empty
      // the cart on the way to the checkout — worse than the bleed it prevents.
      const scopes = ['/promo-b.html', '/promo-b-checkout.html'].map(path =>
        bootedWith(API_KEY, path)
      );

      expect(new Set(scopes).size).toBe(1);
    });

    it('separates two folder funnels sharing one campaign key', () => {
      expect(bootedWith(API_KEY, '/funnel-a/checkout')).not.toBe(
        bootedWith(API_KEY, '/funnel-b/checkout')
      );
    });

    it('separates two campaigns served from the same directory', () => {
      expect(bootedWith('pk_aaaaaaaaaa', '/checkout')).not.toBe(
        bootedWith('pk_bbbbbbbbbb', '/checkout')
      );
    });

    it('separates nested funnels below a shared prefix', () => {
      expect(bootedWith(API_KEY, '/brand-x/funnel-a/checkout')).not.toBe(
        bootedWith(API_KEY, '/brand-x/funnel-b/checkout')
      );
    });

    it('reads the API key from window.nextConfig when there is no tag', () => {
      const viaTag = bootedWith(API_KEY, '/funnel-a/checkout');

      document.head.innerHTML = '';
      (window as unknown as { nextConfig: { apiKey: string } }).nextConfig = {
        apiKey: API_KEY,
      };
      atPath('/funnel-a/checkout');

      expect(storageScope()).toBe(viaTag);
    });

    it('falls back to the path alone when no API key is readable', () => {
      atPath('/funnel-a/checkout');
      expect(storageScope()).toBe('funnel-a');
    });

    it('calls a page with nothing to derive from `root`', () => {
      atPath('/');
      expect(storageScope()).toBe('root');
    });

    it('truncates rather than growing the key', () => {
      expect(
        bootedWith(API_KEY, `/${'a'.repeat(80)}/checkout`).length
      ).toBeLessThanOrEqual(40);
    });
  });

  describe('declared explicitly', () => {
    it('takes the meta tag over anything derived', () => {
      declareMeta('next-api-key', API_KEY);
      declareMeta(STORAGE_SCOPE_META, 'promo-b');
      atPath('/funnel-a/checkout');

      expect(storageScope()).toBe('promo-b');
    });

    it('takes window.nextConfig over the meta tag', () => {
      declareMeta(STORAGE_SCOPE_META, 'from-meta');
      (
        window as unknown as { nextConfig: { storageScope: string } }
      ).nextConfig = { storageScope: 'from-config' };

      expect(storageScope()).toBe('from-config');
    });

    it('falls back to deriving when the declared scope is unusable', () => {
      const derived = bootedWith(API_KEY, '/funnel-a/checkout');

      declareMeta(STORAGE_SCOPE_META, '   ');

      expect(storageScope()).toBe(derived);
    });

    it('sanitises a declared scope', () => {
      declareMeta(STORAGE_SCOPE_META, 'Promo B / 2026');
      expect(storageScope()).toBe('promo-b-2026');
    });
  });

  describe('storageScopeFellBack', () => {
    it('reports a key that was configured but unreadable at import', () => {
      atPath('/funnel-a/checkout');
      expect(storageScopeFellBack(API_KEY)).toBe(true);
    });

    it('says nothing when the key was readable', () => {
      declareMeta('next-api-key', API_KEY);
      atPath('/funnel-a/checkout');

      expect(storageScopeFellBack(API_KEY)).toBe(false);
    });

    it('says nothing when the scope was declared outright', () => {
      declareMeta(STORAGE_SCOPE_META, 'promo-b');
      atPath('/funnel-a/checkout');

      expect(storageScopeFellBack(API_KEY)).toBe(false);
    });

    it('says nothing when no API key was configured at all', () => {
      // That is a fatal boot error with its own message; this warning would only
      // add noise to it.
      expect(storageScopeFellBack('')).toBe(false);
    });
  });
});
