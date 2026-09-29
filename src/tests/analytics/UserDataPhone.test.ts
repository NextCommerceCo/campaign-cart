import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { userDataStorage } from '@/core/analytics/user-data-storage';

/**
 * The phone `dl_user_data` hands every tag: the E.164 the checkout's phone field vouches
 * for, not the national form in the box, which no tag can match to a person
 * (campaign-cart#108).
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

beforeEach(() => userDataStorage.clearUserData());
afterEach(() => {
  document.body.innerHTML = '';
  userDataStorage.clearUserData();
});

describe('the phone dl_user_data reads off the checkout form', () => {
  it('is the E.164 number the phone field vouches for', () => {
    phoneField('(415) 555-2671', '+14155552671');

    userDataStorage.updateFromFormFields();

    expect(userDataStorage.getUserData().phone).toBe('+14155552671');
  });

  it('is left out while the phone field vouches for none', () => {
    phoneField('(415) 55');

    userDataStorage.updateFromFormFields();

    expect(userDataStorage.getUserData().phone).toBeUndefined();
  });

  it("is a plain phone input's value, where the SDK draws no phone field", () => {
    const input = document.createElement('input');
    input.type = 'tel';
    input.name = 'phone';
    input.value = '+14155552671';
    document.body.appendChild(input);

    userDataStorage.updateFromFormFields();

    expect(userDataStorage.getUserData().phone).toBe('+14155552671');
  });
});
