import { describe, expect, it } from 'vitest';
import { buildAttribution } from '../../../src/engine/visit/attribution';
import { makeEngine } from '../../fixtures/engine';
import { MemoryStorage } from '../../fixtures/storage';

describe('attribution', () => {
  it('cuts a metadata value to 2000 code points, the most the platform takes', () => {
    const visit = (landingPage: string, referrer = '') => ({
      landingPage,
      referrer,
      device: 'UA',
      deviceType: 'desktop' as const,
    });
    const metadata = (landing: ReturnType<typeof visit>, params: Record<string, string> = {}) =>
      buildAttribution({ params, landing }, 'Olympus', 1000).metadata;
    const url = (length: number) => 'https://shop.test/?q='.padEnd(length, 'a');

    expect(metadata(visit(url(1999))).landing_page).toBe(url(1999));
    expect(metadata(visit(url(2000))).landing_page).toBe(url(2000));
    expect(metadata(visit(url(2001))).landing_page).toBe(url(2000));

    const emoji = '😀'.repeat(2001);
    expect(metadata(visit('https://shop.test/', emoji)).referrer).toBe('😀'.repeat(2000));
    expect(metadata(visit(url(10)), { fbclid: 'f'.repeat(2500) }).fbclid).toBe('f'.repeat(2000));
    expect(metadata(visit(url(3000))).conversion_timestamp).toBe(1000);
  });

  it('builds the object orders and events carry', () => {
    const visit = {
      landingPage: 'https://shop.test/lp',
      referrer: 'https://google.com',
      device: 'UA',
      deviceType: 'mobile' as const,
      fbp: 'fb.1',
      fbc: '',
      domain: 'shop.test',
      pixelId: '123456',
    };
    expect(
      buildAttribution(
        {
          params: { aff: 'A1', sub2: 'x'.repeat(300), utm_source: 'fb', fbclid: 'F', evclid: 'E', other: 'y' },
          landing: visit,
          geo: { ip: '203.0.113.7' },
        },
        'Olympus',
        1000,
      ),
    ).toEqual({
      affiliate: 'A1',
      funnel: 'Olympus',
      utm_source: 'fb',
      subaffiliate2: 'x'.repeat(225),
      everflow_transaction_id: 'E',
      metadata: {
        landing_page: 'https://shop.test/lp',
        referrer: 'https://google.com',
        device: 'UA',
        device_type: 'mobile',
        fb_fbp: 'fb.1',
        fb_fbc: '',
        domain: 'shop.test',
        fb_pixel_id: '123456',
        sdk_version: expect.any(String),
        conversion_timestamp: 1000,
        user_ip: '203.0.113.7',
        fbclid: 'F',
        everflow_transaction_id: 'E',
      },
    });
  });

  it('records the TikTok, Microsoft and Google app click ids on the order', () => {
    const params = { ttclid: 'T', msclkid: 'M', gbraid: 'G', wbraid: 'W' };
    expect(buildAttribution({ params }, undefined, 0).metadata).toMatchObject(params);
  });

  it('keeps the first landing page of the tab', async () => {
    const store = new MemoryStorage();
    const first = makeEngine({
      session: store,
      visit: { landingPage: 'https://shop.test/lp', referrer: 'r', device: 'UA', deviceType: 'desktop' },
    }).engine;
    const second = makeEngine({
      session: store,
      visit: { landingPage: 'https://shop.test/checkout', referrer: '', device: 'UA', deviceType: 'desktop' },
    }).engine;
    expect(second.attribution().metadata.landing_page).toBe('https://shop.test/lp');
  });

  it('adds the metadata the page set after the SDK’s own keys, cut to 2000 code points', () => {
    const built = buildAttribution(
      {
        params: { fbclid: 'F' },
        metadata: { fb_test_code: 'TEST123', fb_external_id: 'v-1', fbclid: 'PAGE', quiz: 'q'.repeat(2500), n: 7 },
      },
      undefined,
      0,
    );
    expect(built.metadata).toMatchObject({
      fb_test_code: 'TEST123',
      fb_external_id: 'v-1',
      fbclid: 'PAGE',
      quiz: 'q'.repeat(2000),
      n: 7,
      device_type: 'desktop',
    });
  });

  it('takes the Everflow id from the page, else ?evclid, else localStorage.evclid as 0.4.x did', () => {
    const everflow = (params: Record<string, string>, metadata?: Record<string, string | number>, stored?: string) => {
      const built = buildAttribution({ params, metadata }, undefined, 0, undefined, stored);
      return [built.everflow_transaction_id, built.metadata.everflow_transaction_id];
    };
    expect(everflow({}, undefined, 'STORED')).toEqual(['STORED', 'STORED']);
    expect(everflow({ evclid: 'URL' }, undefined, 'STORED')).toEqual(['URL', 'URL']);
    expect(everflow({ evclid: 'URL' }, { everflow_transaction_id: 'PAGE' }, 'STORED')).toEqual(['PAGE', 'PAGE']);
    expect(everflow({}, { everflow_transaction_id: 42 })).toEqual(['42', '42']);
    expect(buildAttribution({ params: {} }, undefined, 0, undefined, null)).not.toHaveProperty(
      'everflow_transaction_id',
    );
  });

  it('reads localStorage.evclid through the storage it was given, each time it is asked', () => {
    const local = new MemoryStorage();
    const { engine } = makeEngine({ local });
    expect(engine.attribution()).not.toHaveProperty('everflow_transaction_id');
    local.setItem('evclid', 'LATER');
    expect(engine.attribution()).toMatchObject({
      everflow_transaction_id: 'LATER',
      metadata: { everflow_transaction_id: 'LATER' },
    });
  });
});
