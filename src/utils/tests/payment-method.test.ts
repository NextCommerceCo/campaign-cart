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
    ['credit_card', 'Credit Card'],
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
    // The platform's payment-methods guide calls SEPA this; an order may carry
    // either name and a receipt has to read the same way.
    ['sepa_direct', 'SEPA Direct Debit'],
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
