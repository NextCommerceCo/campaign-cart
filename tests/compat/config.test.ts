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

  it('is the campaign session id, over a 0.4.43 value', () => {
    const session = '3f2b8c1d9e7a4b6c8d5e2f1a0b9c8d7e';
    history.replaceState(null, '', '/hu/earbuds');
    localStorage.setItem('visitor_id__jv1v6y', 'visitor_m1abc2de_k3j4h5g6f');
    keepLegacyVisitorId(document, window, 'pk_test', session);
    expect(localStorage.getItem('visitor_id__jv1v6y')).toBe(session);
  });
});
