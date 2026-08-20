/**
 * Whether an email, phone, or name is complete enough to send with a prospect
 * cart. Deliberately more lenient than checkout's own field validation — a
 * prospect is captured on partial intent, not a submitted order.
 */

import intlTelInput from 'intl-tel-input';

import {
  checkPhone,
  MIN_PHONE_DIGITS,
  type PhoneNumberSource,
} from '../validation/phone-validation';

import type { PhoneValidationContext } from './prospect-cart.types';

export function isValidEmail(email: string): boolean {
  // More robust email validation regex that supports all valid TLDs
  // Matches: user@domain.com, user.name@domain.co.uk, user@example.co
  // Rejects: test@test....com, spaces, etc.
  const emailRegex =
    /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?$/;

  // Additional validation rules
  if (!emailRegex.test(email)) {
    return false;
  }

  // Check for consecutive dots in local or domain part
  if (email.includes('..')) {
    return false;
  }

  // Check that email doesn't start or end with a dot
  const [localPart, domainPart] = email.split('@');
  if (!localPart || !domainPart) {
    return false;
  }

  if (
    localPart.startsWith('.') ||
    localPart.endsWith('.') ||
    domainPart.startsWith('.') ||
    domainPart.endsWith('.')
  ) {
    return false;
  }

  // Ensure TLD is at least 2 characters (prevents .c, .h, etc.)
  const parts = domainPart.split('.');
  const tld = parts[parts.length - 1];
  if (!tld || tld.length < 2) {
    return false;
  }

  return true;
}

export function isValidPhone(
  phone: string,
  context: PhoneValidationContext
): boolean {
  if (!phone || phone.trim().length === 0) {
    return false;
  }

  // One yardstick for the whole SDK — see `validation/phone-validation.ts`. This path
  // used to carry its own, which is how the same number could be good enough to create a
  // prospect cart and not good enough to submit the order it turns into.
  const instance = context.phoneField
    ? ((context.phoneField as { iti?: PhoneNumberSource }).iti ??
      intlTelInput.getInstance(context.phoneField) ??
      undefined)
    : undefined;

  const check = checkPhone(phone, instance ?? undefined);
  if (check.verdict !== 'unknown') {
    return check.verdict === 'valid';
  }

  // Nothing could judge it. A prospect is captured on partial intent, so the bar here is
  // a plausible digit count rather than a verdict. Default 7 covers most national and
  // international formats; override via ProspectCartConfig.minPhoneDigits or the
  // data-min-phone-digits attribute for a country with shorter or longer numbers.
  const minDigits = context.minPhoneDigits ?? MIN_PHONE_DIGITS;
  const digits = phone.replace(/\D/g, '');
  return digits.length >= minDigits;
}

export function isValidName(name: string): boolean {
  // Name must not be empty
  if (!name || name.trim().length === 0) {
    return false;
  }

  // Name must be at least 2 characters
  if (name.trim().length < 2) {
    return false;
  }

  // Name can only contain letters, spaces, hyphens, apostrophes, and accented characters
  const nameRegex = /^[A-Za-zÀ-ÿ]+(?:[' -][A-Za-zÀ-ÿ]+)*$/;
  return nameRegex.test(name.trim());
}
