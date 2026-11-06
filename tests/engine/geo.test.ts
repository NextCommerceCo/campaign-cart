import { describe, expect, it, vi } from 'vitest';
import { visitorGeo } from '../../src/engine/geo';

const answer = {
  ip: '203.0.113.7',
  country: { code: 'TH', name: 'Thailand' },
  state: { code: '10', name: 'Bangkok' },
  city: 'Bangkok',
  postcode: '10110',
  timezone: 'Asia/Bangkok',
  latitude: 13.75,
  longitude: 100.5,
  language: 'th-TH',
  currency: 'THB',
  region: { code: '142', name: 'Asia', subregion: { code: '035', name: 'South-eastern Asia' } },
  source: 'cf',
};

describe('visitorGeo', () => {
  it('asks i18n-rules once per page, in the page language', async () => {
    const send = vi.fn(async () => new Response(JSON.stringify(answer)));
    const geo = await visitorGeo(send, 'fr', 'https://rules.test');
    await visitorGeo(send, 'fr', 'https://rules.test');
    expect(send).toHaveBeenCalledOnce();
    expect(send).toHaveBeenCalledWith('https://rules.test/v1/geo?lang=fr', {
      method: 'GET',
      headers: { 'X-Next-SDK-Version': expect.any(String) },
    });
    expect(geo).toEqual(answer);
  });

  it('answers undefined when i18n-rules cannot answer', async () => {
    vi.resetModules();
    const { visitorGeo: fresh } = await import('../../src/engine/geo');
    expect(await fresh(async () => new Response('', { status: 429 }))).toBeUndefined();
  });
});
