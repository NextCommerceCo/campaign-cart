/**
 * Finding the email/phone fields a checkout form carries, so the prospect-cart
 * feature can watch them without the form telling it where they are.
 */

import type { FieldDiscoveryContext } from './prospect-cart.types';

export function findEmailField(
  context: FieldDiscoveryContext,
  emailFieldName: string | undefined
): HTMLInputElement | undefined {
  const selectors = [
    '[data-next-checkout-field="email"]',
    '[os-checkout-field="email"]',
    `input[name="${emailFieldName}"]`,
    'input[type="email"]',
    'input[data-field="email"]',
    'input[name*="email"]',
  ];

  for (const selector of selectors) {
    const field = context.element.querySelector(selector) as HTMLInputElement;
    if (field) {
      context.logger.debug('Found email field with selector:', selector);
      return field;
    }
  }

  context.logger.warn('Email field not found for prospect cart');
  return undefined;
}

export function findPhoneField(
  context: FieldDiscoveryContext,
  phoneFieldName: string | undefined
): HTMLInputElement | undefined {
  const selectors = [
    '[data-next-checkout-field="phone"]',
    '[os-checkout-field="phone"]',
    `input[name="${phoneFieldName}"]`,
    'input[type="tel"]',
    'input[data-field="phone"]',
    'input[name*="phone"]',
  ];

  for (const selector of selectors) {
    const field = context.element.querySelector(selector) as HTMLInputElement;
    if (field) {
      context.logger.debug('Found phone field with selector:', selector);
      return field;
    }
  }

  context.logger.warn('Phone field not found for prospect cart');
  return undefined;
}

/**
 * Get formatted phone number in E.164 format from existing intlTelInput instance
 */
export function getFormattedPhoneNumber(
  context: FieldDiscoveryContext
): string {
  // Find the phone field
  const phoneField = context.element.querySelector(
    '[data-next-checkout-field="phone"], [os-checkout-field="phone"], input[name="phone"], input[type="tel"]'
  ) as HTMLInputElement;

  if (!phoneField) {
    return '';
  }

  // intl-tel-input attaches the instance directly as `input.iti`, and also
  // exposes `intlTelInput.getInstance(input)` on the global. Prefer the direct
  // reference — the legacy `window.intlTelInputGlobals` global no longer exists
  // in v19+ of the library.
  const intlTelInputInstance =
    (phoneField as any).iti ||
    (window as any).intlTelInput?.getInstance?.(phoneField);

  if (
    intlTelInputInstance &&
    typeof intlTelInputInstance.getNumber === 'function'
  ) {
    try {
      const e164Number = intlTelInputInstance.getNumber();
      if (e164Number) {
        context.logger.debug(
          'Got E.164 formatted phone from existing instance:',
          e164Number
        );
        return e164Number;
      }
    } catch (error) {
      context.logger.warn(
        'Failed to get E.164 formatted phone from existing instance:',
        error
      );
    }
  }

  // Fallback to raw phone value if intlTelInput not available or not initialized
  context.logger.debug(
    'Using raw phone value (intlTelInput instance not found)'
  );
  return phoneField.value || '';
}
