import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, it, expect } from 'vitest';

import { paymentMethodLabel } from '../payment-method';

/**
 * The one table three call sites read: the order display, the
 * `add_payment_info` event, and the express error message. Each used to carry
 * its own, and the smallest of them decided what a shopper actually read.
 */
describe('paymentMethodLabel', () => {
  it.each([
    ['card_token', 'Credit Card'],
    ['saved_card', 'Saved Card'],
    ['apple_pay', 'Apple Pay'],
    ['google_pay', 'Google Pay'],
    ['paypal', 'PayPal'],
    ['affirm', 'Affirm'],
    ['bancontact', 'Bancontact'],
    ['external', 'External'],
    ['giropay', 'Giropay'],
    ['ideal', 'iDEAL'],
    ['klarna', 'Klarna'],
    ['link', 'Link'],
    ['sepa_debit', 'SEPA Direct Debit'],
    ['sofort', 'Sofort'],
    ['swish', 'Swish'],
    ['twint', 'Twint'],
  ])('labels %s as "%s", the platform’s own name for it', (code, label) => {
    expect(paymentMethodLabel(code)).toBe(label);
  });

  it('reads the same code however it arrived', () => {
    expect(paymentMethodLabel('Apple Pay')).toBe('Apple Pay');
    expect(paymentMethodLabel('apple-pay')).toBe('Apple Pay');
    expect(paymentMethodLabel(' PAYPAL ')).toBe('PayPal');
  });

  it('shows a method it has no label for exactly as it arrived', () => {
    // Never substituted for a friendlier but wrong name, and not title-cased
    // either: a raw code on a receipt gets reported, an invented label does not.
    expect(paymentMethodLabel('pix')).toBe('pix');
    expect(paymentMethodLabel('')).toBe('');
  });
});

/**
 * The table and the API's own union have to stay the same set.
 *
 * Read from the source rather than restated here, because a hand-kept copy is the
 * thing that drifts: this is what fails when a method is added to `PaymentMethod`
 * and nobody gives it a name, and when a label is left behind for a code the API
 * can no longer send.
 */
describe('the label table covers PaymentMethod exactly', () => {
  // `import.meta.url` is a Vite `/@fs/…` URL under Vitest, so it is converted
  // rather than read as a path. Same shape as `src/tests/docs/*`.
  const root = join(dirname(fileURLToPath(import.meta.url)), '../../..');

  function unionValues(): string[] {
    const src = readFileSync(join(root, 'src/types/api.ts'), 'utf8');
    const union = src.split('export type PaymentMethod =')[1]?.split(';')[0];
    return [...(union ?? '').matchAll(/'([a-z_]+)'/g)].map(m => m[1] as string);
  }

  function labelKeys(): string[] {
    const src = readFileSync(join(root, 'src/utils/payment-method.ts'), 'utf8');
    const table = src
      .split('PAYMENT_METHOD_LABELS: Record<string, string> = {')[1]
      ?.split('};')[0];
    return [...(table ?? '').matchAll(/^\s+(\w+):/gm)].map(m => m[1] as string);
  }

  it('has one label per method the API can send', () => {
    expect(labelKeys().sort()).toEqual(unionValues().sort());
  });

  it('labels every method the API can send', () => {
    for (const code of unionValues()) {
      expect(paymentMethodLabel(code)).not.toBe(code);
    }
  });
});
