import { describe, it, expect, afterEach } from 'vitest';

import { ErrorDisplayManager } from '../utils/error-display-utils';

/**
 * Whose message is whose.
 *
 * An error message is an anonymous `<div>` appended near a field, and "near" is decided by
 * `FieldFinder.findFieldWrapper`, which falls back to the field's **parent element** when
 * the page uses none of the wrapper classes it looks for. On such a page every message is a
 * child of the `<form>` — so "remove the error label in this field's wrapper" meant
 * "remove the first error label on the form", and a shopper correcting one field silently
 * erased another field's message while its red outline stayed.
 *
 * These tests use exactly that markup: inputs directly inside a form, no wrappers. It is
 * what `e2e/fixtures/card-purchase.html` ships and what the bug needs.
 */
function buildForm(): {
  form: HTMLFormElement;
  phone: HTMLInputElement;
  city: HTMLInputElement;
} {
  const form = document.createElement('form');
  const phone = document.createElement('input');
  phone.setAttribute('data-next-checkout-field', 'phone');
  const city = document.createElement('input');
  city.setAttribute('data-next-checkout-field', 'city');
  form.append(phone, city);
  document.body.appendChild(form);
  return { form, phone, city };
}

const labelsIn = (form: HTMLFormElement): string[] =>
  [...form.querySelectorAll('.next-error-label')].map(l => l.textContent ?? '');

afterEach(() => {
  document.body.innerHTML = '';
});

describe('error label ownership', () => {
  it('keeps one field’s message when another field is cleared', () => {
    const manager = new ErrorDisplayManager();
    const { form, phone, city } = buildForm();

    manager.showFieldError(phone, 'Please enter a valid phone number');
    manager.clearFieldError(city);

    expect(labelsIn(form)).toEqual(['Please enter a valid phone number']);
  });

  it('still removes the field’s own message', () => {
    const manager = new ErrorDisplayManager();
    const { form, phone } = buildForm();

    manager.showFieldError(phone, 'Please enter a valid phone number');
    manager.clearFieldError(phone);

    expect(labelsIn(form)).toEqual([]);
    expect(phone.classList.contains('next-error-field')).toBe(false);
  });

  it('clears each of two messages independently', () => {
    const manager = new ErrorDisplayManager();
    const { form, phone, city } = buildForm();

    manager.showFieldError(phone, 'Please enter a valid phone number');
    manager.showFieldError(city, 'Please enter a valid city name');
    manager.clearFieldError(phone);

    expect(labelsIn(form)).toEqual(['Please enter a valid city name']);
  });

  it('still removes an unowned message from a real wrapper', () => {
    // A label written by an older build, or by the page's own markup: no owner
    // attribute to match on, so the wrapper lookup is all there is.
    const manager = new ErrorDisplayManager();
    const group = document.createElement('div');
    group.className = 'form-group';
    const field = document.createElement('input');
    field.setAttribute('data-next-checkout-field', 'postal');
    const stale = document.createElement('div');
    stale.className = 'next-error-label';
    stale.textContent = 'Please enter a valid zip code';
    group.append(field, stale);
    document.body.appendChild(group);

    manager.clearFieldError(field);

    expect(group.querySelector('.next-error-label')).toBeNull();
  });
});
