import { afterEach, describe, expect, it } from 'vitest';
import { keepLegacyVisitorId, legacyVisitorKey } from '../../src/compat/config';

const page = window as unknown as { nextConfig?: unknown };
const key = (path: string, apiKey = 'pk_test') => {
  history.replaceState(null, '', path);
  return legacyVisitorKey(document, window, apiKey);
};

afterEach(() => {
  delete page.nextConfig;
  document.head.innerHTML = '';
  localStorage.clear();
  history.replaceState(null, '', '/');
});

describe('visitor id (0.4.x localStorage)', () => {
  it('is keyed by hash(api key, first folder) as 0.4.43 did, not as 0.5 storage is', () => {
    expect(key('/hu/earbuds/checkout')).toBe('visitor_id__jv1v6y');
    expect(key('/sleep/')).toBe('visitor_id__q38pip');
    expect(key('/presell.html')).toBe('visitor_id__q38pip');
    expect(key('/My_Funnel/checkout')).toBe('visitor_id__hhgxcm');
    expect(key('/hu/earbuds', '')).toBe('visitor_id');
  });

  it('takes the scope from nextConfig.storageScope first', () => {
    page.nextConfig = { storageScope: 'Promo B' };
    document.head.innerHTML = '<meta name="next-storage-scope" content="other">';
    expect(key('/hu/earbuds')).toBe('visitor_id__promo-b');
  });

  it('takes the scope from <meta name="next-storage-scope">, with or without an api key', () => {
    document.head.innerHTML = '<meta name="next-storage-scope" content="Promo_B!">';
    expect(key('/hu/earbuds')).toBe('visitor_id__promo-b');
    expect(key('/hu/earbuds', '')).toBe('visitor_id__promo-b');
  });

  it('creates a 0.4.43-format id once, and keeps an existing one untouched', () => {
    history.replaceState(null, '', '/hu/earbuds');
    keepLegacyVisitorId(document, window, 'pk_test');
    const first = localStorage.getItem('visitor_id__jv1v6y');
    expect(first).toMatch(/^visitor_[0-9a-z]+_[0-9a-z]{1,9}$/);
    history.replaceState(null, '', '/hu/earbuds/upsell1');
    keepLegacyVisitorId(document, window, 'pk_test');
    expect(localStorage.getItem('visitor_id__jv1v6y')).toBe(first);
    localStorage.setItem('visitor_id__jv1v6y', 'visitor_m1abc2de_k3j4h5g6f');
    keepLegacyVisitorId(document, window, 'pk_test');
    expect(localStorage.getItem('visitor_id__jv1v6y')).toBe('visitor_m1abc2de_k3j4h5g6f');
  });
});
