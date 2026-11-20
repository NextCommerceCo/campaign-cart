import { describe, expect, it } from 'vitest';
import { isWallet, paymentCode, paymentLabel, paymentType } from '../../../src/engine/order/payment';

describe('payment methods', () => {
  it('turns page and campaign payment words into API codes', () => {
    expect(
      ['credit', 'apple-pay', 'Klarna', 'card_token', 'bankcard', 'Credit Card', 'sepa_debit'].map(paymentCode),
    ).toEqual(['card_token', 'apple_pay', 'klarna', 'card_token', 'card_token', 'card_token', 'sepa_debit']);
  });

  it('names a method for the page, else by the campaign’s label, else by the code the API sent', () => {
    const offered = [{ code: 'acme_wallet', label: 'Acme Wallet' }];
    expect(
      ['card_token', 'apple-pay', 'sepa_debit', 'afterpay', 'acme_wallet', 'other'].map((code) =>
        paymentLabel(code, offered),
      ),
    ).toEqual(['Credit Card', 'Apple Pay', 'SEPA Direct Debit', 'Afterpay', 'Acme Wallet', 'other']);
  });

  it('sends a card as Credit Card in 0.4.x analytics and any other method by its code', () => {
    expect(['card_token', 'paypal', undefined].map(paymentType)).toEqual(['Credit Card', 'paypal', undefined]);
  });

  it('knows the wallets the form may check less for', () => {
    expect(['paypal', 'apple_pay', 'google_pay', 'shop_pay', 'card_token'].filter(isWallet)).toEqual([
      'paypal',
      'apple_pay',
      'google_pay',
      'shop_pay',
    ]);
  });
});
