import { describe, expect, it } from 'vitest';
import { buildAttribution, type Visit } from '../../src/engine/attribution';
import { checkLink, readSource, type SourceInput } from '../../src/debug/source';

const LANDING =
  'https://shop.test/bf/landing?utm_source=facebook&utm_medium=paid_social&utm_campaign=bf&fbclid=IwAR1&ttclid=tt9&affid=1042&sub1=adset_7';

const input = (
  params: Record<string, string>,
  opts: { landingPage?: string; current?: string; fbc?: string; cookieFbc?: string } = {},
): SourceInput => {
  const { landingPage = LANDING, current = LANDING, fbc = 'fb.1.1.IwAR1' } = opts;
  const cookieFbc = opts.cookieFbc ?? fbc;
  const landing: Visit = {
    landingPage,
    referrer: 'https://l.facebook.com/',
    device: 'test',
    deviceType: 'mobile',
    ...(fbc && { fbc }),
  };
  return {
    params,
    landing,
    current,
    attribution: buildAttribution({ params, landing }, 'bf-main', 0),
    cookies: { fbc: cookieFbc },
  };
};
const landed = Object.fromEntries(new URL(LANDING).searchParams);

describe('source of a tab', () => {
  it('names who the order is credited to and where each value goes', () => {
    const s = readSource(input(landed, { current: 'https://shop.test/checkout/?' + new URL(LANDING).searchParams }));
    expect(s.headline).toBe('facebook / paid_social · bf');
    expect(s.platforms).toEqual(['Meta', 'TikTok', 'Affiliate 1042']);
    expect(s.params.map((p) => [p.key, p.from, p.order, p.events])).toEqual([
      ['utm_source', 'landing', true, true],
      ['utm_medium', 'landing', true, true],
      ['utm_campaign', 'landing', true, true],
      ['fbclid', 'landing', true, true],
      ['ttclid', 'landing', false, false],
      ['affid', 'landing', true, true],
      ['sub1', 'landing', true, true],
      ['_fbc', 'cookie', true, true],
      ['landing', 'visit', true, true],
      ['referrer', 'visit', true, false],
      ['funnel', 'visit', true, true],
    ]);
    expect(s.unset).toEqual(['utm_content', 'utm_term']);
    expect(s.steps.map((step) => [step.label, step.detail, step.tone])).toEqual([
      ['Captured', '7 params on /bf/landing', 'done'],
      ['Kept', '7 params in this tab', 'done'],
      ['Carried', "On this page's URL", 'done'],
      ['On the order', 'Not recorded: ttclid', 'warn'],
    ]);
  });

  it('marks a value a later page replaced, and one the URL no longer carries', () => {
    const params = { ...landed, utm_campaign: 'retarget' };
    const s = readSource(input(params, { current: 'https://shop.test/checkout/?utm_campaign=retarget' }));
    expect(s.params.find((p) => p.key === 'utm_campaign')).toMatchObject({ from: 'page', was: 'bf', order: true });
    expect(s.headline).toBe('facebook / paid_social · retarget');
    expect(s.steps[2]).toMatchObject({ tone: 'warn', detail: expect.stringMatching(/^Not on this URL: utm_source, /) });
  });

  it('flags a landing param the tab lost', () => {
    const { utm_source: _, ...rest } = landed;
    expect(readSource(input(rest)).steps[1]).toEqual({ label: 'Kept', detail: 'Lost utm_source', tone: 'warn' });
  });

  it('flags a Meta cookie set after the landing page read it', () => {
    const fbc = readSource(input(landed, { fbc: '', cookieFbc: 'fb.1.2.IwAR1' })).params.find((p) => p.key === '_fbc');
    expect(fbc).toMatchObject({ value: 'fb.1.2.IwAR1', note: 'Set after the landing page read it', order: false });
  });

  it('calls a visit with no params and no referrer direct', () => {
    const s = readSource({ ...input({}, { landingPage: 'https://shop.test/', fbc: '' }), landing: undefined });
    expect(s.headline).toBe('direct / none');
    expect(s.platforms).toEqual([]);
  });
});

describe('checking an ad link', () => {
  it('splits its params into recorded on the order, carried only, and not tracked', () => {
    expect(checkLink('https://shop.test/?utm_source=google&gclid=g1&msclkid=m1&color=red')).toEqual({
      order: ['utm_source', 'gclid'],
      linksOnly: ['msclkid'],
      other: ['color'],
    });
  });

  it('refuses a link that is not a full URL', () => {
    expect(checkLink('shop.test/?utm_source=x')).toBeUndefined();
  });
});
