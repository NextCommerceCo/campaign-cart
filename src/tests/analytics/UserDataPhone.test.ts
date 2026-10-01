import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { dataLayer } from '@/core/analytics/data-layer-manager';
import { UserDataTracker } from '@/core/analytics/tracking/user-data-tracker';
import { userDataStorage } from '@/core/analytics/user-data-storage';
import { useCheckoutStore } from '@/state/checkout';

/**
 * `customer_phone` is E.164 or absent, on every page: the national form in the box,
 * `(415) 555-2671`, is a number no tag can match to a person (campaign-cart#108).
 */

function phoneField(value: string, e164?: string): HTMLInputElement {
  const input = document.createElement('input');
  input.type = 'tel';
  input.setAttribute('data-next-checkout-field', 'phone');
  input.classList.add('next-phone-input');
  input.value = value;
  if (e164) input.setAttribute('data-next-phone-e164', e164);
  document.body.appendChild(input);
  return input;
}

function plainPhoneField(value: string): void {
  const input = document.createElement('input');
  input.type = 'tel';
  input.name = 'phone';
  input.value = value;
  document.body.appendChild(input);
}

let now = Date.UTC(2026, 8, 30);

/** The `customer_phone` of the `dl_user_data` the tracker pushes now. */
function trackedPhone(): unknown {
  const push = vi.spyOn(dataLayer, 'push').mockImplementation(() => {});
  // Past the tracker's one-second debounce.
  vi.setSystemTime((now += 5000));
  UserDataTracker.getInstance().trackUserData();
  const event = push.mock.calls.at(-1)?.[0] as
    | { user_properties?: Record<string, unknown> }
    | undefined;
  push.mockRestore();
  return event?.user_properties?.customer_phone;
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  userDataStorage.clearUserData();
  useCheckoutStore.getState().reset();
});
afterEach(() => {
  document.body.innerHTML = '';
  userDataStorage.clearUserData();
  useCheckoutStore.getState().reset();
  vi.useRealTimers();
});

describe('customer_phone on dl_user_data is E.164 or absent', () => {
  it('is the E.164 the phone field vouches for, not the national form it shows', () => {
    phoneField('(415) 555-2671', '+14155552671');

    expect(trackedPhone()).toBe('+14155552671');
  });

  it('is absent while the phone field vouches for none', () => {
    phoneField('(415) 55');

    expect(trackedPhone()).toBeUndefined();
  });

  it("is a plain phone input's value when that value is E.164", () => {
    plainPhoneField('+14155552671');

    expect(trackedPhone()).toBe('+14155552671');
  });

  it('is absent when a plain phone input holds a national number', () => {
    plainPhoneField('(415) 555-2671');

    expect(trackedPhone()).toBeUndefined();
  });

  it('is the stored E.164 on a page with no phone field', () => {
    userDataStorage.updateUserData({ phone: '+14155552671' });

    expect(trackedPhone()).toBe('+14155552671');
  });

  it('is absent on a page with no phone field when only a national number was offered', () => {
    userDataStorage.updateUserData({ phone: '(415) 555-2671' });

    expect(trackedPhone()).toBeUndefined();
  });

  it('is the billing phone when it is E.164', () => {
    useCheckoutStore
      .getState()
      .setBillingAddress(billingWithPhone('+14155552671'));

    expect(trackedPhone()).toBe('+14155552671');
  });

  it('is absent when the billing phone was stored as typed', () => {
    useCheckoutStore
      .getState()
      .setBillingAddress(billingWithPhone('(415) 555-2671'));

    expect(trackedPhone()).toBeUndefined();
  });
});

function billingWithPhone(phone: string) {
  return {
    first_name: 'Jordan',
    last_name: 'Chen',
    address1: '1 Main St',
    city: 'San Francisco',
    province: 'CA',
    postal: '94105',
    country: 'US',
    phone,
  };
}
