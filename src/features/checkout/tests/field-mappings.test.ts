import { describe, it, expect } from 'vitest';

import {
  isKnownPaymentMethod,
  namesStoredPaymentMethod,
  toApiPaymentMethod,
  toCheckoutPaymentMethod,
} from '../constants/field-mappings';

/**
 * The translations a payment method makes on its way from a radio to an order.
 * None of them had a test until a card stopped being selected by default in
 * 0.4.35 and nothing failed.
 */
describe('toCheckoutPaymentMethod', () => {
  it.each([
    ['credit', 'credit-card'],
    ['card_token', 'credit-card'],
    ['paypal', 'paypal'],
    ['apple_pay', 'apple_pay'],
    ['ideal', 'ideal'],
    ['sepa_debit', 'sepa_debit'],
  ])('reads the radio value %s as %s', (radio, method) => {
    expect(toCheckoutPaymentMethod(radio)).toBe(method);
  });

  it('reads a spelling the page chose over the documented one', () => {
    expect(toCheckoutPaymentMethod('apple-pay')).toBe('apple_pay');
    expect(toCheckoutPaymentMethod(' APPLE_PAY ')).toBe('apple_pay');
  });

  it('keeps a method the SDK has no name for', () => {
    expect(toCheckoutPaymentMethod('Pix')).toBe('pix');
  });

  it('reads a radio naming nothing as nothing', () => {
    expect(toCheckoutPaymentMethod('')).toBe(undefined);
    expect(toCheckoutPaymentMethod(null)).toBe(undefined);
    expect(toCheckoutPaymentMethod(undefined)).toBe(undefined);
  });

  /**
   * This is a page-word table, so it is **not** safe to run a store value through:
   * the store's own word for a card, `credit-card`, normalises to `credit_card`,
   * which is deliberately not a radio name. `namesStoredPaymentMethod` exists
   * because a caller did exactly this and the card stopped being selected.
   */
  it('does not recognise the store spelling of a card as a radio name', () => {
    expect(toCheckoutPaymentMethod('credit-card')).toBe('credit_card');
    expect(isKnownPaymentMethod('credit_card')).toBe(false);
  });
});

/**
 * The one question `initializePaymentForms` asks of every wrapper on the page.
 * Getting it wrong is invisible: the page renders, nothing throws, and the
 * shopper simply meets a checkout with no payment method chosen.
 */
describe('namesStoredPaymentMethod', () => {
  it('matches the card wrapper to the method the store starts on', () => {
    expect(namesStoredPaymentMethod('credit', 'credit-card')).toBe(true);
  });

  it('matches the card wrapper to a card written under the API name', () => {
    expect(namesStoredPaymentMethod('credit', 'card_token')).toBe(true);
    expect(namesStoredPaymentMethod('card_token', 'credit-card')).toBe(true);
  });

  it.each([
    ['paypal', 'paypal'],
    ['apple-pay', 'apple_pay'],
    ['ideal', 'ideal'],
    ['sepa_debit', 'sepa_debit'],
  ])('matches the %s wrapper to a stored %s', (markup, stored) => {
    expect(namesStoredPaymentMethod(markup, stored)).toBe(true);
  });

  it('matches a method the SDK has no name for under its own name', () => {
    expect(namesStoredPaymentMethod('pix', 'pix')).toBe(true);
  });

  it('does not match a different method', () => {
    expect(namesStoredPaymentMethod('ideal', 'credit-card')).toBe(false);
    expect(namesStoredPaymentMethod('credit', 'ideal')).toBe(false);
    expect(namesStoredPaymentMethod('credit', 'pix')).toBe(false);
  });

  it('matches nothing for a wrapper that names no method', () => {
    expect(namesStoredPaymentMethod('', 'credit-card')).toBe(false);
    expect(namesStoredPaymentMethod(null, 'credit-card')).toBe(false);
    expect(namesStoredPaymentMethod(undefined, 'credit-card')).toBe(false);
  });

  /**
   * A card wrapper written under a name the SDK does not accept stays unmatched,
   * so this predicate cannot become a back door into the card vocabulary that
   * `toCheckoutPaymentMethod` keeps at two names.
   */
  it('does not match a card wrapper named in a spelling the SDK refuses', () => {
    expect(namesStoredPaymentMethod('credit-card', 'credit-card')).toBe(false);
    expect(namesStoredPaymentMethod('card', 'credit-card')).toBe(false);
  });
});

describe('isKnownPaymentMethod', () => {
  it('knows the card by the name the store holds it under', () => {
    expect(isKnownPaymentMethod('credit-card')).toBe(true);
  });

  it('does not know a method this release predates', () => {
    expect(isKnownPaymentMethod('pix')).toBe(false);
  });
});

describe('toApiPaymentMethod', () => {
  it('sends the card as the orders API names it', () => {
    expect(toApiPaymentMethod('credit-card')).toBe('card_token');
  });

  it('sends every other method as it stands', () => {
    expect(toApiPaymentMethod('ideal')).toBe('ideal');
    expect(toApiPaymentMethod('pix')).toBe('pix');
  });
});
