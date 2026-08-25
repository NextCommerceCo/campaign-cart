import { describe, it, expect, afterEach } from 'vitest';

import { ErrorDisplayManager } from '../utils/error-display-utils';

/**
 * What `ErrorDisplayManager` leaves on a field, as opposed to whose message is whose
 * (`error-label-ownership.test.ts`).
 *
 * Both cases here are asymmetries: something the manager sets in one method and does not
 * account for in another, so a field ends up in a state nothing on the page put it in.
 */

const manager = new ErrorDisplayManager();

function buildForm(): {
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

afterEach(() => {
  document.body.innerHTML = '';
});

describe('clearAllErrors', () => {
  /**
   * `showFieldValid` sets the success class and the tick. A sweep that clears only the
   * error half leaves a field showing a tick it has not just earned.
   */
  it('clears the success marks, not only the error ones', () => {
    const { form, email } = buildForm();
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
    const { form, email } = buildForm();
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
    const orphan = document.createElement('input');
    orphan.setAttribute('data-next-checkout-field', 'phone');

    manager.showFieldError(orphan, 'Enter a phone number');

    expect(orphan.classList.contains('has-error')).toBe(true);
    expect(orphan.classList.contains('next-error-field')).toBe(true);
  });

  it('is undone by clearFieldError, which never needed a wrapper either', () => {
    const orphan = document.createElement('input');
    orphan.setAttribute('data-next-checkout-field', 'phone');

    manager.showFieldError(orphan, 'Enter a phone number');
    manager.clearFieldError(orphan);

    expect(orphan.classList.contains('has-error')).toBe(false);
    expect(orphan.classList.contains('next-error-field')).toBe(false);
  });
});
