import { describe, expect, it } from 'vitest';
import { addDollars, cents, dollars, formatCents } from '../../src/engine/format';
import type { Campaign } from '../../src/engine/types';

describe('money helpers', () => {
  it('reads API amounts as cents and dollars', () => {
    expect(cents('19.99')).toBe(1999);
    expect(cents(undefined)).toBe(0);
    expect(dollars('19.995')).toBe(20);
    expect(dollars(0.1 + 0.2)).toBe(0.3);
  });

  it('adds dollar amounts without float drift', () => {
    expect(addDollars([0.1, 0.2])).toBe(0.3);
    expect(addDollars([])).toBe(0);
  });

  it("formats cents in the campaign's currency, in the page's language over the campaign's", () => {
    const campaign = { currency: 'EUR', language: 'en' } as Campaign;
    expect(formatCents(1999, { campaign })).toBe('€19.99');
    expect(formatCents(1999, { campaign, locale: 'de-DE' })).toBe('19,99 €');
    expect(formatCents(1999, {})).toBe('19.99');
  });
});
