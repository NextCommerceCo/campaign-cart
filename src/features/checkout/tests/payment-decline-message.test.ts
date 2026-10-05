import { afterEach, describe, expect, it, vi } from 'vitest';
import type { CountryService } from '@/core/i18n-rules';
import { useConfigStore } from '@/state/config';
import {
  declineCode,
  isPaymentDecline,
  paymentDeclineMessage,
} from '../utils/payment-decline-message';

const TEXTS = {
  'payment.errors.3005': 'Check your card number and try again.',
  'payment.errors.generic': "Your card couldn't be processed. Try again.",
};

/** A service whose texts in every language are `texts`, or that never loads any. */
function service(texts?: Record<string, string>): CountryService {
  return {
    getTexts: () => texts,
    loadTexts: vi.fn(() => Promise.resolve()),
  } as unknown as CountryService;
}

afterEach(() => {
  useConfigStore.setState({ translations: undefined });
  vi.useRealTimers();
});

describe('paymentDeclineMessage', () => {
  it('shows the service’s sentence for the code, not the gateway’s words', async () => {
    expect(
      await paymentDeclineMessage(
        {
          payment_response_code: '3005',
          payment_details: 'Invalid Card Number',
        },
        'en',
        service(TEXTS)
      )
    ).toBe('Check your card number and try again.');
  });

  it('reads a code sent as a number', async () => {
    expect(
      await paymentDeclineMessage(
        { payment_response_code: 3005 },
        'en',
        service(TEXTS)
      )
    ).toBe('Check your card number and try again.');
  });

  it('takes the page’s own wording for a code first', async () => {
    useConfigStore.setState({
      translations: { en: { 'payment.errors.3005': 'Card number?' } },
    });
    expect(
      await paymentDeclineMessage(
        { payment_response_code: '3005' },
        'en',
        service(TEXTS)
      )
    ).toBe('Card number?');
  });

  it('takes the page’s own generic sentence ahead of the gateway’s words', async () => {
    useConfigStore.setState({
      translations: { en: { 'payment.errors.generic': 'Payment failed.' } },
    });
    expect(
      await paymentDeclineMessage(
        { payment_response_code: '9999', payment_details: 'Something new' },
        'en',
        service(TEXTS)
      )
    ).toBe('Payment failed.');
    // And while the service's texts cannot be loaded, so its reason never shows.
    expect(
      await paymentDeclineMessage(
        {
          payment_response_code: '3009',
          payment_details: 'Fraudulent Transaction',
        },
        'en',
        service(undefined)
      )
    ).toBe('Payment failed.');
  });

  it('still shows the page’s sentence for a code ahead of its generic one', async () => {
    useConfigStore.setState({
      translations: {
        en: {
          'payment.errors.generic': 'Payment failed.',
          'payment.errors.3005': 'Card number?',
        },
      },
    });
    expect(
      await paymentDeclineMessage(
        { payment_response_code: '3005' },
        'en',
        service(TEXTS)
      )
    ).toBe('Card number?');
  });

  it('shows the gateway’s words for a code the service has no sentence for', async () => {
    expect(
      await paymentDeclineMessage(
        { payment_response_code: '9999', payment_details: 'Something new' },
        'en',
        service(TEXTS)
      )
    ).toBe('Something new');
  });

  it('shows the gateway’s words when the service’s texts could not be loaded', async () => {
    expect(
      await paymentDeclineMessage(
        {
          payment_response_code: '3005',
          payment_details: 'Invalid Card Number',
        },
        'en',
        service(undefined)
      )
    ).toBe('Invalid Card Number');
  });

  it('shows the generic sentence when there is neither, in English when nothing loaded', async () => {
    expect(
      await paymentDeclineMessage(
        { payment_response_code: '9999', payment_details: ' ' },
        'en',
        service({ 'payment.errors.generic': 'Generic.' })
      )
    ).toBe('Generic.');
    expect(
      await paymentDeclineMessage(
        { payment_response_code: '9999' },
        'en',
        service(undefined)
      )
    ).toBe("Your card couldn't be processed. Try again.");
  });

  it('waits a moment for texts no element has loaded, and no longer', async () => {
    vi.useFakeTimers();
    const never = {
      getTexts: () => undefined,
      loadTexts: () => new Promise<void>(() => {}),
    } as unknown as CountryService;
    const answer = paymentDeclineMessage(
      { payment_response_code: '3005', payment_details: 'Invalid Card Number' },
      'en',
      never
    );
    await vi.advanceTimersByTimeAsync(1500);
    expect(await answer).toBe('Invalid Card Number');
  });
});

describe('isPaymentDecline', () => {
  it('is a decline when the answer carries a code or the gateway’s words', () => {
    expect(isPaymentDecline({ payment_response_code: '3005' })).toBe(true);
    expect(isPaymentDecline({ payment_details: 'Declined' })).toBe(true);
    expect(isPaymentDecline({ message: 'Out of stock' })).toBe(false);
    expect(isPaymentDecline(null)).toBe(false);
  });

  it('reads the code as a string', () => {
    expect(declineCode({ payment_response_code: 3005 })).toBe('3005');
    expect(declineCode({ payment_response_code: { code: 1 } })).toBeUndefined();
  });
});
