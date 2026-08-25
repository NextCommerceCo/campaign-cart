import { describe, it, expect, afterEach } from 'vitest';

import { ErrorDisplayManager } from '../utils/error-display-utils';

/**
 * `ErrorDisplayManager`, in two parts: whose message is whose, and what is left on a field
 * afterwards. Both are asymmetries — something one method sets and another does not account
 * for, so a field ends up in a state nothing on the page put it in.
 *
 * The ownership half needs the markup below: an error message is an anonymous `<div>`
 * appended near a field, and "near" is decided by `FieldFinder.findFieldWrapper`, which
 * falls back to the field's **parent element** when the page uses none of the wrapper
 * classes it looks for. On such a page every message is a child of the `<form>` — so
 * "remove the error label in this field's wrapper" meant "remove the first error label on
 * the form", and a shopper correcting one field silently erased another field's message
 * while its red outline stayed. It is what `e2e/fixtures/card-purchase.html` ships.
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

  it('leaves an unowned message alone when the container holds other fields too', () => {
    // Several inputs in one `.form-group` is ordinary markup. The first unowned label
    // inside it belongs to whichever field comes first, not to the one being cleared.
    const group = document.createElement('div');
    group.className = 'form-group';
    const phone = document.createElement('input');
    phone.setAttribute('data-next-checkout-field', 'phone');
    const city = document.createElement('input');
    city.setAttribute('data-next-checkout-field', 'city');
    const stale = document.createElement('div');
    stale.className = 'next-error-label';
    stale.textContent = 'Please enter a valid phone number';
    group.append(phone, city, stale);
    document.body.appendChild(group);

    new ErrorDisplayManager().clearFieldError(city);

    expect(group.querySelector('.next-error-label')?.textContent).toBe(
      'Please enter a valid phone number'
    );
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

/**
 * The markup the SDK styles: a `.form-group` around the input. Used by the state tests
 * below, where the question is which classes are left on a field rather than which
 * container a message was found in.
 */
function buildWrappedField(): {
  form: HTMLFormElement;
  email: HTMLInputElement;
} {
  const form = document.createElement('form');
  const group = document.createElement('div');
  group.className = 'form-group';
  const email = document.createElement('input');
  email.setAttribute('data-next-checkout-field', 'email');
  group.appendChild(email);
  form.appendChild(group);
  document.body.appendChild(form);
  return { form, email };
}

describe('clearAllErrors', () => {
  /**
   * `showFieldValid` sets the success class and the tick. A sweep that clears only the
   * error half leaves a field showing a tick it has not just earned.
   */
  it('clears the success marks, not only the error ones', () => {
    const manager = new ErrorDisplayManager();
    const { form, email } = buildWrappedField();

    manager.showFieldValid(email);

    expect(email.classList.contains('no-error')).toBe(true);
    expect(email.closest('.form-group')?.classList.contains('addTick')).toBe(
      true
    );

    manager.clearAllErrors(form);

    expect(email.classList.contains('no-error')).toBe(false);
    expect(email.closest('.form-group')?.classList.contains('addTick')).toBe(
      false
    );
  });

  it('still clears the error marks and the message', () => {
    const manager = new ErrorDisplayManager();
    const { form, email } = buildWrappedField();

    manager.showFieldError(email, 'Enter an email address');
    manager.clearAllErrors(form);

    expect(form.querySelectorAll('.next-error-label')).toHaveLength(0);
    expect(email.classList.contains('has-error')).toBe(false);
    expect(email.classList.contains('next-error-field')).toBe(false);
  });
});

describe('showFieldError without a wrapper', () => {
  /**
   * `clearFieldError` takes the classes off whether or not a wrapper was found, so showing
   * has to put them on under the same condition. A field with no parent at all is the only
   * markup where the two differ, since `findFieldWrapper` otherwise falls back to the
   * parent element.
   */
  it('marks the field even when there is no container to put the message in', () => {
    const manager = new ErrorDisplayManager();
    const orphan = document.createElement('input');
    orphan.setAttribute('data-next-checkout-field', 'phone');

    manager.showFieldError(orphan, 'Enter a phone number');

    expect(orphan.classList.contains('has-error')).toBe(true);
    expect(orphan.classList.contains('next-error-field')).toBe(true);
  });

  it('is undone by clearFieldError, which never needed a wrapper either', () => {
    const manager = new ErrorDisplayManager();
    const orphan = document.createElement('input');
    orphan.setAttribute('data-next-checkout-field', 'phone');

    manager.showFieldError(orphan, 'Enter a phone number');
    manager.clearFieldError(orphan);

    expect(orphan.classList.contains('has-error')).toBe(false);
    expect(orphan.classList.contains('next-error-field')).toBe(false);
  });
});
