import { describe, expect, it, vi } from 'vitest';
import { askGeo, type VisitorGeo, visitorGeo } from '../../../src/engine/visit/geo';
import { makeEngine } from '../../fixtures/engine';
import { MemoryStorage } from '../../fixtures/storage';

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

describe('askGeo', () => {
  it('asks i18n-rules in the page language, and answers undefined when it cannot answer', async () => {
    const send = vi.fn(async () => new Response(JSON.stringify(answer)));
    expect(await askGeo(send, 'fr', 'https://rules.test')).toEqual(answer);
    expect(send).toHaveBeenCalledWith('https://rules.test/v1/geo?lang=fr', { method: 'GET' });
    expect(await askGeo(async () => new Response('', { status: 429 }))).toBeUndefined();
  });
});

describe('visitorGeo', () => {
  it('asks once per tab and keeps the answer with the visit for the next page', async () => {
    const session = new MemoryStorage();
    const ask = vi.fn(async () => answer as VisitorGeo);
    const first = makeEngine({ session }).engine;
    const [geo] = await first.attach((ctx) => Promise.all([visitorGeo(ctx, ask), visitorGeo(ctx, ask)]));
    expect(geo).toEqual(answer);
    expect(first.getState().visit.geo).toEqual(answer);
    const next = makeEngine({ session }).engine;
    expect(await next.attach((ctx) => visitorGeo(ctx, ask))).toEqual(answer);
    expect(ask).toHaveBeenCalledOnce();
  });

  it('keeps nothing when i18n-rules cannot answer, so the next page asks again', async () => {
    const session = new MemoryStorage();
    const ask = vi.fn(async () => undefined);
    const first = makeEngine({ session }).engine;
    expect(await first.attach((ctx) => visitorGeo(ctx, ask))).toBeUndefined();
    await first.attach((ctx) => visitorGeo(ctx, ask));
    expect(first.getState().visit.geo).toBeUndefined();
    await makeEngine({ session }).engine.attach((ctx) => visitorGeo(ctx, ask));
    expect(ask).toHaveBeenCalledTimes(2);
  });
});
