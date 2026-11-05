import { describe, expect, it } from 'vitest';
import { addDollars, cents, dollars, formatCents } from '../../src/engine/format';

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

  it("formats cents in the campaign's currency and language", () => {
    expect(formatCents(1999, { currency: 'USD', language: 'en' })).toBe('$19.99');
    expect(formatCents(1999)).toBe('19.99');
  });
});
