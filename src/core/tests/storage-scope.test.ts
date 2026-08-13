import { describe, it, expect, beforeEach, afterAll } from 'vitest';

import {
  storageScope,
  storageScopeSuffix,
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
    it('is the same on every page under one top folder, at any depth', () => {
      // The layout in production: a locale folder with every page of the campaign
      // under it. The token is the top folder, so walking deeper into the funnel
      // does not move it.
      const scopes = [
        '/hu/earbuds',
        '/hu/earbuds/',
        '/hu/earbuds/checkout',
        '/hu/earbuds/upsell1',
        '/hu/portable-ac/receipt/index.html',
      ].map(path => bootedWith(API_KEY, path));

      expect(new Set(scopes).size).toBe(1);
    });

    it('keeps root-level siblings together', () => {
      // The regression that pulled two earlier designs. `/apollo-presell/` and
      // `/apollo-checkout/` are two pages of one funnel with no folder above
      // either, so neither may contribute a token — a scope built from their one
      // segment changes on the way to the checkout and empties the cart.
      const scopes = [
        '/apollo-presell/',
        '/apollo-checkout/',
        '/apollo-upsell1/',
        '/promo-b.html',
        '/',
      ].map(path => bootedWith(API_KEY, path));

      expect(new Set(scopes).size).toBe(1);
    });

    it('separates two top folders running one campaign key', () => {
      // The case the campaign token cannot see, and the only thing the base path
      // buys: same key, two funnels, different folders.
      expect(bootedWith(API_KEY, '/a/presell')).not.toBe(
        bootedWith(API_KEY, '/b/presell')
      );
    });

    it('separates a page in a folder from one at the root', () => {
      // The cost of the depth rule, asserted rather than left to be discovered: a
      // funnel that mixes `/hu/` with `/hu/checkout` gets two scopes and has to
      // declare one outright.
      expect(bootedWith(API_KEY, '/hu/')).not.toBe(
        bootedWith(API_KEY, '/hu/checkout')
      );
    });

    it('ignores everything below the first segment', () => {
      expect(bootedWith(API_KEY, '/hu/a/b/c/d')).toBe(
        bootedWith(API_KEY, '/hu/z')
      );
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
      expect(bootedWith(API_KEY, '/')).toMatch(/^[a-z0-9]+$/);
    });
  });

  describe('what it contributes to a key name', () => {
    it('joins with __ when there is a scope', () => {
      const scope = bootedWith(API_KEY, '/hu/offer');

      expect(storageScopeSuffix()).toBe(`__${scope}`);
    });

    it('contributes nothing when there is not', () => {
      // The bare name is the point: it is exactly what the SDK wrote before scoping
      // existed, so a page that cannot read its key degrades to a known state rather
      // than to a new key called `__root`.
      expect(storageScope()).toBe('');
      expect(storageScopeSuffix()).toBe('');
    });
  });

  describe('the folder cannot reach the key', () => {
    it('is the same shape whatever the folder is called', () => {
      // The two halves are hashed together rather than joined, so nothing about a
      // folder name — its length, its punctuation, its case — reaches a key name.
      const plain = bootedWith(API_KEY, '/hu/offer');
      const awkward = bootedWith(API_KEY, '/Summer Skin // 2026!/offer');
      const enormous = bootedWith(API_KEY, `/${'a'.repeat(400)}/offer`);

      for (const scope of [plain, awkward, enormous]) {
        expect(scope).toMatch(/^[a-z0-9]+$/);
        expect(scope.length).toBeLessThanOrEqual(7);
      }
      expect(new Set([plain, awkward, enormous]).size).toBe(3);
    });

    it('reads one folder the same way however it is spelled in the URL', () => {
      // Case and a trailing slash are not a different funnel.
      expect(bootedWith(API_KEY, '/HU/offer')).toBe(
        bootedWith(API_KEY, '/hu/offer')
      );
    });

    it('cannot be made to collide by moving the boundary', () => {
      // Concatenating the two halves without a separator would file the key `pk_x`
      // on `/hu/…` and the key `pk_xhu` at the root under one scope.
      expect(bootedWith('pk_x', '/hu/offer')).not.toBe(
        bootedWith('pk_xhu', '/offer')
      );
    });
  });

  describe('when no API key is readable', () => {
    it('writes the bare key rather than anything per-page', () => {
      // The fallback has to be identical on every page: degrading to the
      // pre-scoping behaviour is recoverable, degrading to a per-page scope loses
      // the shopper's cart. Empty, not a word — the key is then exactly the name
      // the SDK wrote before scoping existed.
      atPath('/hu/earbuds');
      const presell = storageScope();
      atPath('/de/portable-ac/checkout');

      expect(storageScope()).toBe(presell);
      expect(presell).toBe('');
      expect(storageScopeSuffix()).toBe('');
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
