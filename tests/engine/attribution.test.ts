import { describe, expect, it } from 'vitest';
import { buildAttribution } from '../../src/engine/attribution';
import { makeEngine } from '../fixtures/engine';
import { MemoryStorage } from '../fixtures/storage';

describe('attribution', () => {
  it('builds the object orders and events carry', () => {
    const visit = {
      landingPage: 'https://shop.test/lp',
      referrer: 'https://google.com',
      device: 'UA',
      deviceType: 'mobile' as const,
      fbp: 'fb.1',
      fbc: '',
    };
    expect(
      buildAttribution(
        { aff: 'A1', sub2: 'x'.repeat(300), utm_source: 'fb', fbclid: 'F', evclid: 'E', other: 'y' },
        visit,
        'Olympus',
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
        fbclid: 'F',
        everflow_transaction_id: 'E',
      },
    });
  });

  it('keeps the first landing page of the tab', async () => {
    const store = new MemoryStorage();
    const first = makeEngine({
      session: store,
      visit: { landingPage: 'https://shop.test/lp', referrer: 'r', device: 'UA', deviceType: 'desktop' },
    }).engine;
    first.restore();
    const second = makeEngine({
      session: store,
      visit: { landingPage: 'https://shop.test/checkout', referrer: '', device: 'UA', deviceType: 'desktop' },
    }).engine;
    second.restore();
    expect(second.attribution().metadata.landing_page).toBe('https://shop.test/lp');
  });
});
