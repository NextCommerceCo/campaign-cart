import { describe, it, expect, beforeEach, afterAll } from 'vitest';

import { storageScope, STORAGE_SCOPE_META } from '@/core/storage-scope';

const originalLocation = Object.getOwnPropertyDescriptor(window, 'location');

function atPath(pathname: string): void {
  Object.defineProperty(window, 'location', {
    configurable: true,
    value: { pathname },
  });
}

function declareMeta(content: string): void {
  const meta = document.createElement('meta');
  meta.setAttribute('name', STORAGE_SCOPE_META);
  meta.setAttribute('content', content);
  document.head.appendChild(meta);
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

  describe('derived from the path', () => {
    it('uses the first path segment', () => {
      atPath('/funnel-a/');
      expect(storageScope()).toBe('funnel-a');
    });

    it('stays the same across every page of one funnel', () => {
      // The reason it is the first segment and not the whole pathname: the cart has
      // to survive the walk from the offer page to checkout to the receipt. A scope
      // that changed here would empty the cart mid-funnel, which is worse than the
      // cross-campaign bleed it is meant to fix.
      const scopes = [
        '/funnel-a/',
        '/funnel-a/checkout',
        '/funnel-a/upsell1',
        '/funnel-a/receipt',
      ].map(path => {
        atPath(path);
        return storageScope();
      });

      expect(new Set(scopes)).toEqual(new Set(['funnel-a']));
    });

    it('separates two funnels on one origin', () => {
      atPath('/funnel-a/checkout');
      const a = storageScope();
      atPath('/funnel-b/checkout');

      expect(storageScope()).not.toBe(a);
    });

    it('calls the origin root `root`', () => {
      atPath('/');
      expect(storageScope()).toBe('root');
    });

    it('sanitises a segment that is a file name', () => {
      atPath('/Promo-B.html');
      expect(storageScope()).toBe('promo-b-html');
    });

    it('truncates a long segment rather than growing the key', () => {
      atPath(`/${'a'.repeat(80)}/checkout`);
      expect(storageScope()).toHaveLength(40);
    });
  });

  describe('declared explicitly', () => {
    it('takes the meta tag over the path', () => {
      atPath('/promo-b-checkout.html');
      declareMeta('promo-b');

      expect(storageScope()).toBe('promo-b');
    });

    it('holds one scope across a flat-file funnel', () => {
      // The layout the meta tag exists for: every page is a file at the root, so
      // the derived scope would differ on each one.
      declareMeta('promo-b');
      const scopes = ['/promo-b.html', '/promo-b-checkout.html'].map(path => {
        atPath(path);
        return storageScope();
      });

      expect(new Set(scopes)).toEqual(new Set(['promo-b']));
    });

    it('takes window.nextConfig over the meta tag', () => {
      declareMeta('from-meta');
      (
        window as unknown as { nextConfig: { storageScope: string } }
      ).nextConfig = { storageScope: 'from-config' };

      expect(storageScope()).toBe('from-config');
    });

    it('falls back to the path when the declared scope is unusable', () => {
      atPath('/funnel-a/');
      declareMeta('   ');

      expect(storageScope()).toBe('funnel-a');
    });

    it('sanitises a declared scope', () => {
      declareMeta('Promo B / 2026');
      expect(storageScope()).toBe('promo-b-2026');
    });
  });
});
