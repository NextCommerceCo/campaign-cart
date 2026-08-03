import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  findFirstErrorFieldInDOM,
  focusCreditCardErrorField,
  focusFirstErrorField,
} from '../first-error-field';

/** happy-dom does no layout, so every rect is zero — stamp the tops the test needs. */
function buildField(name: string, top: number): HTMLInputElement {
  const input = document.createElement('input');
  input.setAttribute('data-next-checkout-field', name);
  input.getBoundingClientRect = () => ({ top }) as DOMRect;
  document.body.appendChild(input);
  return input;
}

afterEach(() => {
  document.body.innerHTML = '';
  delete (window as any).Spreedly;
});

describe('findFirstErrorFieldInDOM', () => {
  it('returns undefined when nothing failed', () => {
    expect(findFirstErrorFieldInDOM({})).toBeUndefined();
  });

  it('picks the field highest on the page, not the first key', () => {
    buildField('email', 300);
    buildField('fname', 100);
    buildField('city', 200);

    expect(
      findFirstErrorFieldInDOM({ email: 'x', city: 'x', fname: 'x' })
    ).toBe('fname');
  });

  it('skips fields that are not on the page', () => {
    buildField('city', 200);

    expect(findFirstErrorFieldInDOM({ 'cc-number': 'x', city: 'x' })).toBe(
      'city'
    );
  });

  it('falls back to the first key when no error field is on the page', () => {
    expect(findFirstErrorFieldInDOM({ 'cc-number': 'x', cvv: 'x' })).toBe(
      'cc-number'
    );
  });
});

describe('focusFirstErrorField', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('does nothing without a field, so callers need no guard', () => {
    expect(() => focusFirstErrorField(undefined)).not.toThrow();
  });

  it('scrolls first and focuses once the scroll has settled', () => {
    const field = buildField('email', 100);
    const scrollIntoView = vi.fn();
    field.scrollIntoView = scrollIntoView;
    const focus = vi.spyOn(field, 'focus');

    focusFirstErrorField('email');

    expect(scrollIntoView).toHaveBeenCalledWith({
      behavior: 'smooth',
      block: 'center',
    });
    expect(focus).not.toHaveBeenCalled();

    vi.advanceTimersByTime(800);
    expect(focus).toHaveBeenCalled();
  });

  it('hands the CVV to the payment provider instead of focusing it', () => {
    const transferFocus = vi.fn();
    (window as any).Spreedly = { transferFocus };

    focusFirstErrorField('cvv');

    expect(transferFocus).toHaveBeenCalledWith('cvv');
  });

  /**
   * DEFECT (left as found) — the guard list is
   * `['cc-month', 'cc-year', 'number', 'cvv', 'exp-month', 'exp-year']`, which contains
   * `number` but **not** `cc-number`. The only producer of a card-number error is
   * `form-validation.ts`, and it writes the key `cc-number`
   * (`error.field === 'number' ? 'cc-number' : 'cvv'`). So the key that is actually
   * produced never matches the list, and `focusCreditCardErrorField`'s own `cc-number`
   * branch — which does the right thing — is unreachable from here.
   *
   * `cc-number` therefore falls through to the ordinary path, where `FieldFinder` cannot
   * find it because the input lives inside the Spreedly iframe. The result is a silent
   * no-op.
   *
   * What the shopper sees: they submit with a card number the provider rejected as empty
   * or malformed. The message appears next to the card field, but the page does not scroll
   * and nothing is focused. On a long checkout the message is below the fold, so the form
   * looks like it did nothing when the pay button was pressed.
   */
  it('DEFECT: cc-number is not in the card list, so the card-number error never focuses', () => {
    const transferFocus = vi.fn();
    (window as any).Spreedly = { transferFocus };

    focusFirstErrorField('cc-number');
    expect(transferFocus).not.toHaveBeenCalled();

    // The branch it should have reached works when called directly.
    focusCreditCardErrorField('cc-number');
    expect(transferFocus).toHaveBeenCalledWith('number');
  });

  it('focuses the expiry dropdowns normally — they are ours, not the iframe’s', () => {
    const field = buildField('cc-month', 100);
    field.scrollIntoView = vi.fn();
    const focus = vi.spyOn(field, 'focus');

    focusFirstErrorField('cc-month');

    expect(focus).toHaveBeenCalled();
  });
});
