import { describe, expect, it } from 'vitest';
import { nextUrl, parseForcePackages } from '../../../src/engine/visit/params';
import { makeEngine, type MakeEngine } from '../../fixtures/engine';
import { MemoryStorage } from '../../fixtures/storage';

describe('next page URL', () => {
  const params = { utm_source: 'fb', gclid: 'G1', email: 'jane@x.com', debugger: 'true', reset: '1' };
  const here = new URL('https://shop.test/lp');

  it('carries every kept param to the same site', () => {
    expect(nextUrl('/checkout', here, params)).toBe(
      'https://shop.test/checkout?utm_source=fb&gclid=G1&email=jane%40x.com',
    );
  });

  it('leaves the gateway failure params on the page they came to', () => {
    expect(nextUrl('/checkout', here, { utm_source: 'fb', payment_failed: 'true', payment_method: 'paypal' })).toBe(
      'https://shop.test/checkout?utm_source=fb',
    );
  });

  it('carries only attribution params to another site', () => {
    expect(nextUrl('https://partner.test/checkout', here, params)).toBe(
      'https://partner.test/checkout?utm_source=fb&gclid=G1',
    );
  });
});

describe('forcePackageId', () => {
  it('reads ids with optional quantities', () => {
    expect(parseForcePackages('2')).toEqual([{ packageId: 2, quantity: 1 }]);
    expect(parseForcePackages('2:3,5')).toEqual([
      { packageId: 2, quantity: 3 },
      { packageId: 5, quantity: 1 },
    ]);
    expect(parseForcePackages('abc')).toEqual([]);
  });
});

describe('attribution params of a same-origin referrer', () => {
  const page = 'https://shop.test/checkout';
  const arrive = (referrer: string, opts: MakeEngine = {}) =>
    makeEngine({ ...opts, visit: { landingPage: page, referrer, device: 'UA', deviceType: 'desktop' } }).engine;
  const params = (referrer: string, opts?: MakeEngine) => arrive(referrer, opts).getState().visit.params;

  it('adopts them on a page that came without any, and nothing else', () => {
    expect(params('https://shop.test/lp?affid=A1&utm_source=fb&sub1=S1&other=x')).toEqual({
      affid: 'A1',
      utm_source: 'fb',
      sub1: 'S1',
    });
    expect(params('https://shop.test/lp')).toEqual({});
    expect(params('')).toEqual({});
  });

  it('adopts nothing from another origin', () => {
    expect(params('https://ads.test/lp?affid=A1&utm_source=fb')).toEqual({});
    expect(params('https://shop.test.ads.test/lp?affid=A1')).toEqual({});
    expect(params('http://shop.test/lp?affid=A1')).toEqual({});
  });

  it('leaves a visit with attribution params of its own as it is, from the URL or the session', () => {
    const referrer = 'https://shop.test/lp?affid=A1&utm_source=fb';
    expect(params(referrer, { params: { utm_source: 'google' } })).toEqual({ utm_source: 'google' });
    const session = new MemoryStorage();
    makeEngine({ session, params: { affid: 'FIRST' } });
    expect(params(referrer, { session })).toEqual({ affid: 'FIRST' });
    expect(params(referrer, { params: { step: '2' } })).toEqual({ affid: 'A1', utm_source: 'fb', step: '2' });
  });

  it('carries the adopted params to links, the order attribution and the tab’s next pages', () => {
    const session = new MemoryStorage();
    const engine = arrive('https://shop.test/lp?affid=A1&utm_source=fb&sub1=S1', { session });
    expect(nextUrl('/upsell', new URL(page), engine.getState().visit.params)).toBe(
      'https://shop.test/upsell?affid=A1&utm_source=fb&sub1=S1',
    );
    expect(engine.attribution()).toMatchObject({ affiliate: 'A1', utm_source: 'fb', subaffiliate1: 'S1' });
    expect(makeEngine({ session }).engine.attribution()).toMatchObject({ affiliate: 'A1', utm_source: 'fb' });
  });
});
