import { describe, expect, it, vi } from 'vitest';
import { fill, flattenTexts, loadedTexts, rulesSend, serviceTexts, textsIn } from '../../src/engine/texts';

const served = (texts: unknown, lang: string) =>
  Promise.resolve(new Response(JSON.stringify(texts), { headers: { 'content-language': lang } }));

describe('texts', () => {
  it('reads i18next JSON, nested or flat, as one text per dotted key', () => {
    expect(flattenTexts({ fields: { email: { label: 'Email' } }, 'coupon.applied': 'Applied', n: 1 })).toEqual({
      'fields.email.label': 'Email',
      'coupon.applied': 'Applied',
    });
  });

  it('picks the page’s texts for th-TH, then th', () => {
    const translations = { 'th-th': { a: 'regional' }, th: { a: 'base' } };
    expect(textsIn(translations, 'th-TH')).toEqual({ a: 'regional' });
    expect(textsIn(translations, 'th-LA')).toEqual({ a: 'base' });
    expect(textsIn(translations, 'de')).toEqual({});
  });

  it('fills {{name}} placeholders and leaves unknown ones', () => {
    expect(fill('Coupon {{ code }} applied, {{other}}', { code: 'SAVE10' })).toBe('Coupon SAVE10 applied, {{other}}');
  });

  it('asks i18n-rules once per language, and keeps only an answer in that language', async () => {
    const send = vi.fn((url: string) =>
      url.includes('/locales/nl')
        ? served({ checkout: { pay: 'Betalen' } }, 'nl')
        : served({ checkout: { pay: 'Pay' } }, 'en'),
    );
    const [first, second] = await Promise.all([serviceTexts(send, 'nl-BE'), serviceTexts(send, 'nl')]);
    expect(first).toEqual({ 'checkout.pay': 'Betalen' });
    expect(second).toBe(first);
    expect(loadedTexts('NL')).toBe(first);
    expect(await serviceTexts(send, 'ja')).toBeUndefined();
    expect(send).toHaveBeenCalledTimes(2);
  });

  it('asks again after a failed answer', async () => {
    const send = vi
      .fn()
      .mockRejectedValueOnce(new Error('offline'))
      .mockReturnValueOnce(served({ a: 'b' }, 'sv'));
    expect(await serviceTexts(send, 'sv')).toBeUndefined();
    expect(await serviceTexts(send, 'sv')).toEqual({ a: 'b' });
  });

  it('names the SDK version, and the campaign once it has loaded, on each request to i18n-rules', async () => {
    const send = vi.fn(async (_url: string, _init: RequestInit) => new Response('{}'));
    let campaign: { id: number; name: string } | undefined;
    const ask = rulesSend(send, () => campaign);
    await ask('https://rules.test/v1/geo', { method: 'GET' });
    campaign = { id: 42, name: 'Olympus ไทย' };
    await ask('https://rules.test/v1/validate', { method: 'POST', headers: { 'Content-Type': 'application/json' } });
    expect(send.mock.calls[0]![1].headers).toEqual({ 'X-Next-SDK-Version': expect.any(String) });
    expect(send.mock.calls[1]![1].headers).toEqual({
      'X-Next-SDK-Version': expect.any(String),
      'X-Next-Campaign-Id': '42',
      'X-Next-Campaign-Name': 'Olympus%20%E0%B9%84%E0%B8%97%E0%B8%A2',
      'Content-Type': 'application/json',
    });
    expect(() => new Headers(send.mock.calls[1]![1].headers)).not.toThrow();
  });
});
