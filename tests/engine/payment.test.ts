import { describe, expect, it } from 'vitest';
import { isExpress, isWallet, paymentCode, paymentLabel, paymentType } from '../../src/engine/payment';

describe('payment methods', () => {
  it('turns page and campaign payment words into API codes', () => {
    expect(['credit', 'apple-pay', 'Klarna', 'card_token', 'bankcard', 'Credit Card'].map(paymentCode)).toEqual([
      'card_token',
      'apple_pay',
      'klarna',
      'card_token',
      'card_token',
      'card_token',
    ]);
  });

  it('names a method for the page, else shows the code the API sent', () => {
    expect(['card_token', 'apple-pay', 'Shop Pay', 'acme_wallet'].map(paymentLabel)).toEqual([
      'Credit Card',
      'Apple Pay',
      'Shop Pay',
      'acme_wallet',
    ]);
  });

  it('sends a card as Credit Card in 0.4.x analytics and any other method by its code', () => {
    expect(['card_token', 'paypal', undefined].map(paymentType)).toEqual(['Credit Card', 'paypal', undefined]);
  });

  it('knows the wallets the form may check less for and the express buttons', () => {
    expect(['paypal', 'apple_pay', 'google_pay', 'shop_pay', 'card_token'].filter(isWallet)).toEqual([
      'paypal',
      'apple_pay',
      'google_pay',
    ]);
    expect(['paypal', 'apple_pay', 'google_pay', 'shop_pay', 'klarna'].filter(isExpress)).toEqual([
      'paypal',
      'apple_pay',
      'google_pay',
      'shop_pay',
    ]);
  });
});
