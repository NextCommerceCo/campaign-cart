import { describe, it, expect, vi } from 'vitest';
import type { Iti } from 'intl-tel-input';
import { readFieldValue, readPhoneValue } from '../field-value';

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
   * `handleFieldChange` sends every `billing-*` name down the billing branch before this
   * function is reached, so `billing-phone` has no arm here — it is read by
   * `billing-field-routing.ts` through {@link readPhoneValue} instead. Pinned so that a
   * later caller who does route a billing name through here notices the gap rather than
   * silently storing the national text on the order.
   */
  it('has no billing-phone arm — the billing branch reads it', () => {
    const phoneInputs = new Map([['billing', phoneInstance('+447700900999')]]);

    expect(
      readFieldValue(
        'billing-phone',
        input({ value: '07700 900999' }),
        phoneInputs
      )
    ).toBe('07700 900999');
  });
});

describe('readPhoneValue', () => {
  it('prefers the instance it is handed', () => {
    // Both instances answer for the same typed number; only the handed one is asked.
    // A marker that is not recognisably the same number would be discarded rather than
    // preferred — see `describesSameNumber` in `validation/phone-validation.ts`.
    const handed = phoneInstance('+447700900123');
    const onTheElement = phoneInstance('+447700900999');
    const field = input({ value: '07700 900123' });
    (field as unknown as { iti: Iti }).iti = onTheElement;

    expect(readPhoneValue(field, handed)).toBe('+447700900123');
  });

  /**
   * The widget reads its own field, not the value it is asked about, so a number restored
   * from an earlier page can be judged against a field holding something else entirely.
   * The typed value wins there rather than a stranger's number reaching the order.
   */
  it('ignores an instance answering about a different number', () => {
    expect(
      readPhoneValue(
        input({ value: '07700 900123' }),
        phoneInstance('+15558675')
      )
    ).toBe('07700 900123');
  });

  it('falls back to the typed text when there is no instance anywhere', () => {
    expect(readPhoneValue(input({ value: '07700 900123' }))).toBe(
      '07700 900123'
    );
  });

  it('falls back to the typed text when the number cannot be parsed', () => {
    expect(readPhoneValue(input({ value: '123' }), phoneInstance(null))).toBe(
      '123'
    );
  });

  /** A `<select>` can never carry a phone widget, so it is never asked for one. */
  it('reads a select as its value', () => {
    const select = document.createElement('select');
    const option = document.createElement('option');
    option.value = 'CA';
    select.appendChild(option);
    select.value = 'CA';

    expect(readPhoneValue(select)).toBe('CA');
  });
});
