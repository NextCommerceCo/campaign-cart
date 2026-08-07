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
    it('is the same on every page of a campaign, whatever the URL', () => {
      // Production puts each page of a funnel in its own sibling directory, so a
      // path-derived scope changes between the offer and the checkout and empties
      // the cart on the way. That shipped twice — once keyed on the first path
      // segment, once on the directory. The URL is not an input.
      const scopes = [
        '/apollo-presell/',
        '/apollo-checkout/',
        '/apollo-upsell1/',
        '/apollo-receipt/index.html',
        '/',
        '/deeply/nested/page.html',
      ].map(path => bootedWith(API_KEY, path));

      expect(new Set(scopes).size).toBe(1);
    });

    it('separates two campaigns', () => {
      expect(bootedWith('pk_campaign_alpha', '/')).not.toBe(
        bootedWith('pk_campaign_beta', '/')
      );
    });

    it('separates two keys that share a long prefix', () => {
      // Hashed rather than truncated: keys issued to one account agree on their
      // first several characters, and a prefix token filed both under one scope.
      expect(bootedWith('test-e2e-key-xxxxx', '/')).not.toBe(
        bootedWith('test-e2e-key-yyyyy', '/')
      );
    });

    it('reads the API key from window.nextConfig when there is no tag', () => {
      const viaTag = bootedWith(API_KEY, '/apollo-checkout/');

      document.head.innerHTML = '';
      (window as unknown as { nextConfig: { apiKey: string } }).nextConfig = {
        apiKey: API_KEY,
      };

      expect(storageScope()).toBe(viaTag);
    });

    it('is a token that cannot break the key it is joined to', () => {
      expect(bootedWith(API_KEY, '/')).toMatch(/^[a-z0-9]{1,40}$/);
    });
  });

  describe('when no API key is readable', () => {
    it('falls back to one shared scope rather than anything per-page', () => {
      // The fallback has to be identical on every page: degrading to the
      // pre-scoping behaviour is recoverable, degrading to a per-page scope loses
      // the shopper's cart.
      atPath('/apollo-presell/');
      const presell = storageScope();
      atPath('/apollo-checkout/');

      expect(storageScope()).toBe(presell);
      expect(presell).toBe('root');
    });

    it('reports itself when a key really was configured', () => {
      atPath('/apollo-checkout/');
      expect(storageScopeFellBack(API_KEY)).toBe(true);
    });

    it('says nothing when the key was readable', () => {
      declareMeta('next-api-key', API_KEY);
      expect(storageScopeFellBack(API_KEY)).toBe(false);
    });

    it('says nothing when the scope was declared outright', () => {
      declareMeta(STORAGE_SCOPE_META, 'promo-b');
      expect(storageScopeFellBack(API_KEY)).toBe(false);
    });

    it('says nothing when no API key was configured at all', () => {
      // That is a fatal boot error with its own message; this warning would only
      // add noise to it.
      expect(storageScopeFellBack('')).toBe(false);
    });
  });

  describe('declared explicitly', () => {
    it('takes the meta tag over the derived scope', () => {
      declareMeta('next-api-key', API_KEY);
      declareMeta(STORAGE_SCOPE_META, 'promo-b');

      expect(storageScope()).toBe('promo-b');
    });

    it('separates two funnels that share one campaign key', () => {
      // The only case deriving cannot cover, and the reason the override exists.
      declareMeta('next-api-key', API_KEY);
      declareMeta(STORAGE_SCOPE_META, 'funnel-a');
      const a = storageScope();

      document.head.innerHTML = '';
      declareMeta('next-api-key', API_KEY);
      declareMeta(STORAGE_SCOPE_META, 'funnel-b');

      expect(storageScope()).not.toBe(a);
    });

    it('takes window.nextConfig over the meta tag', () => {
      declareMeta(STORAGE_SCOPE_META, 'from-meta');
      (
        window as unknown as { nextConfig: { storageScope: string } }
      ).nextConfig = { storageScope: 'from-config' };

      expect(storageScope()).toBe('from-config');
    });

    it('falls back to deriving when the declared scope is unusable', () => {
      const derived = bootedWith(API_KEY, '/');

      declareMeta(STORAGE_SCOPE_META, '   ');

      expect(storageScope()).toBe(derived);
    });

    it('sanitises a declared scope', () => {
      declareMeta(STORAGE_SCOPE_META, 'Promo B / 2026');
      expect(storageScope()).toBe('promo-b-2026');
    });

    it('truncates a long declared scope rather than growing the key', () => {
      declareMeta(STORAGE_SCOPE_META, 'a'.repeat(80));
      expect(storageScope()).toHaveLength(40);
    });
  });
});
