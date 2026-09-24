/**
 * Finding the email/phone fields a checkout form carries, so the prospect-cart
 * feature can watch them without the form telling it where they are.
 */

import { phoneFieldFor } from '../checkout-form/phone-input';

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
 * The phone number for the prospect cart: E.164 from the checkout's phone field when the
 * input has one, else the text as typed.
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

  const e164 = phoneFieldFor(phoneField)?.getNumber();
  if (e164) return e164;

  context.logger.debug('Using raw phone value (no phone field formats it)');
  return phoneField.value || '';
}
