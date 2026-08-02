/**
 * Whether an email, phone, or name is complete enough to send with a prospect
 * cart. Deliberately more lenient than checkout's own field validation — a
 * prospect is captured on partial intent, not a submitted order.
 */

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

  // Prefer intlTelInput validation when available. The instance is attached
  // to the input as `.iti` by the library (v19+); fall back to the global
  // getter. The legacy `window.intlTelInputGlobals` global is gone in v19+.
  if (context.phoneField) {
    const intlTelInputInstance =
      (context.phoneField as any).iti ||
      (window as any).intlTelInput?.getInstance?.(context.phoneField);
    if (
      intlTelInputInstance &&
      typeof intlTelInputInstance.isValidNumber === 'function'
    ) {
      try {
        return intlTelInputInstance.isValidNumber();
      } catch (error) {
        context.logger.debug(
          'intlTelInput isValidNumber threw, falling back:',
          error
        );
      }
    }
  }

  // Fallback when intlTelInput is unavailable: require a minimum digit count.
  // Default 7 covers most national/international formats; override via
  // ProspectCartConfig.minPhoneDigits or the data-min-phone-digits attribute
  // when the page targets a country with shorter/longer valid numbers.
  const minDigits = context.minPhoneDigits ?? 7;
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
