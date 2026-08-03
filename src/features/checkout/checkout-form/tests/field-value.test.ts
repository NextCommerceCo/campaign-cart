import { describe, it, expect, vi } from 'vitest';
import type { Iti } from 'intl-tel-input';
import { readFieldValue } from '../field-value';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function phoneInstance(number: string | null): Iti {
  return { getNumber: vi.fn(() => number) } as unknown as Iti;
}

function input(
  attributes: { type?: string; value?: string; checked?: boolean } = {}
): HTMLInputElement {
  const element = document.createElement('input');
  if (attributes.type) element.type = attributes.type;
  if (attributes.value !== undefined) element.value = attributes.value;
  if (attributes.checked !== undefined) element.checked = attributes.checked;
  return element;
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('readFieldValue', () => {
  it('stores a text field as typed', () => {
    expect(readFieldValue('fname', input({ value: 'Ada' }), new Map())).toBe(
      'Ada'
    );
  });

  it('stores the E.164 number for the shipping phone, not the typed text', () => {
    const phoneInputs = new Map([['shipping', phoneInstance('+447700900123')]]);

    expect(
      readFieldValue('phone', input({ value: '07700 900123' }), phoneInputs)
    ).toBe('+447700900123');
  });

  /**
   * `getNumber()` returns null for a number the library cannot parse. The typed text is
   * stored instead so the order carries something a human can act on rather than nothing.
   */
  it('falls back to the typed text when the number cannot be parsed', () => {
    const phoneInputs = new Map([['shipping', phoneInstance(null)]]);

    expect(readFieldValue('phone', input({ value: '123' }), phoneInputs)).toBe(
      '123'
    );
  });

  it('falls back to the typed text when there is no phone instance', () => {
    expect(
      readFieldValue('phone', input({ value: '07700 900123' }), new Map())
    ).toBe('07700 900123');
  });

  it('stores a checkbox as a boolean, not the string "on"', () => {
    expect(
      readFieldValue(
        'accepts_marketing',
        input({ type: 'checkbox', checked: true }),
        new Map()
      )
    ).toBe(true);
    expect(
      readFieldValue(
        'accepts_marketing',
        input({ type: 'checkbox', checked: false }),
        new Map()
      )
    ).toBe(false);
  });

  it('stores a radio as a boolean too', () => {
    expect(
      readFieldValue(
        'shipping_method',
        input({ type: 'radio', checked: true }),
        new Map()
      )
    ).toBe(true);
  });

  it('stores a select as its selected value', () => {
    const select = document.createElement('select');
    const option = document.createElement('option');
    option.value = 'CA';
    select.appendChild(option);
    select.value = 'CA';

    expect(readFieldValue('country', select, new Map())).toBe('CA');
  });

  /**
   * DEFECT (left as found): the `billing-phone` arm is unreachable in production.
   *
   * `handleFieldChange` sends every name starting with `billing-` down the billing branch
   * before this function is reached, so a billing phone is never read through here — it is
   * written to `billingAddress` as the national text the shopper typed, while
   * `phone-input.ts` had already written the E.164 number and gets overwritten. The arm
   * still behaves correctly if it is ever called, which is what this pins.
   */
  it('DEFECT: handles billing-phone correctly but is never reached with it', () => {
    const phoneInputs = new Map([['billing', phoneInstance('+447700900999')]]);

    expect(
      readFieldValue(
        'billing-phone',
        input({ value: '07700 900999' }),
        phoneInputs
      )
    ).toBe('+447700900999');
  });
});
