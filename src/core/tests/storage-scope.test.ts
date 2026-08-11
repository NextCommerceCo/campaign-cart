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

/** A page of a funnel: the campaign's key, and the funnel's name when it declares one. */
function bootedOn(apiKey: string, funnel: string | null): string {
  document.head.innerHTML = '';
  declareMeta('next-api-key', apiKey);
  if (funnel !== null) declareMeta('next-funnel', funnel);
  return storageScope();
}

describe('storageScope', () => {
  beforeEach(() => {
    document.head.innerHTML = '';
    delete (window as unknown as { nextConfig?: unknown }).nextConfig;
    // The resolved scope is remembered here, so a leaked pointer would let one test
    // decide the next one's answer.
    sessionStorage.clear();
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

  describe('when the page names its funnel', () => {
    it('separates two funnels running one campaign key', () => {
      // The case the campaign token cannot see: same key, same catalog, two funnels
      // that must not hand each other a cart.
      expect(bootedOn(API_KEY, 'apollo')).not.toBe(bootedOn(API_KEY, 'zeus'));
    });

    it('is the same on every page of the funnel, whatever the URL', () => {
      const scopes = [
        '/apollo-presell/',
        '/apollo-checkout/',
        '/apollo-checkout/upsell1',
        '/',
      ].map(path => {
        atPath(path);
        return bootedOn(API_KEY, 'apollo');
      });

      expect(new Set(scopes).size).toBe(1);
    });

    it('still separates two campaigns that use the same funnel name', () => {
      expect(bootedOn('pk_campaign_alpha', 'checkout')).not.toBe(
        bootedOn('pk_campaign_beta', 'checkout')
      );
    });

    it('reads the funnel off a tracking tag as well as next-funnel', () => {
      const campaignOnly = bootedWith(API_KEY, '/');
      const viaFunnelTag = bootedOn(API_KEY, 'apollo');
      sessionStorage.clear();

      document.head.innerHTML = '';
      declareMeta('next-api-key', API_KEY);
      const tag = document.createElement('meta');
      tag.setAttribute('name', 'data-next-tracking-tag');
      tag.setAttribute('data-tag-name', 'funnel_name');
      tag.setAttribute('data-tag-value', 'apollo');
      document.head.appendChild(tag);

      expect(storageScope()).toBe(viaFunnelTag);
      expect(viaFunnelTag).not.toBe(campaignOnly);
    });

    it('ignores a funnel remembered from another campaign', () => {
      // `next_funnel_name` is written by the attribution collector to localStorage and
      // is never scoped, so a name left behind by the campaign before this one would
      // otherwise decide this one's cart key.
      const untagged = bootedWith(API_KEY, '/');
      const tagged = bootedOn(API_KEY, 'apollo');
      sessionStorage.clear();

      expect(tagged).not.toBe(untagged);

      localStorage.setItem('next_funnel_name', 'zeus');
      try {
        expect(bootedOn(API_KEY, 'apollo')).toBe(tagged);
        sessionStorage.clear();
        expect(bootedOn(API_KEY, null)).toBe(untagged);
      } finally {
        localStorage.removeItem('next_funnel_name');
      }
    });

    it('is a token that cannot break the key it is joined to', () => {
      expect(bootedOn(API_KEY, 'Summer Skin / 2026')).toMatch(
        /^[a-z0-9-]{1,40}$/
      );
    });
  });

  describe('when a page of a tagged funnel omits the tag', () => {
    it('inherits the funnel scope instead of minting a second one', () => {
      // The failure this exists to stop: the checkout page of a tagged funnel loses
      // the tag in an edit, resolves to the campaign token alone, and the shopper
      // arrives with an empty cart.
      const campaignOnly = bootedWith(API_KEY, '/');
      const presell = bootedOn(API_KEY, 'apollo');

      expect(bootedOn(API_KEY, null)).toBe(presell);
      // The negative control: inheriting is only worth anything if the two scopes
      // were going to differ.
      expect(presell).not.toBe(campaignOnly);
    });

    it('does not inherit across campaigns', () => {
      const alpha = bootedOn('pk_campaign_alpha', 'apollo');

      expect(bootedOn('pk_campaign_beta', null)).not.toBe(alpha);
      expect(bootedOn('pk_campaign_beta', null)).toBe(
        bootedWith('pk_campaign_beta', '/')
      );
    });

    it('starts from the campaign token when no tagged page has been seen', () => {
      expect(bootedOn(API_KEY, null)).toBe(bootedWith(API_KEY, '/'));
    });

    it('follows the funnel a later tagged page declares', () => {
      bootedOn(API_KEY, 'apollo');
      const zeus = bootedOn(API_KEY, 'zeus');

      expect(bootedOn(API_KEY, null)).toBe(zeus);
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
