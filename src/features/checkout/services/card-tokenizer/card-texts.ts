/**
 * Every text around the hosted card fields, by the key the address-rules service serves
 * it under (`payment.card.number.errors.invalid`). A text comes from the page's
 * `nextConfig.translations`, then the service's texts in the form's language, then the
 * English here — the same order the address form reads its own.
 */

import { addressLang, I18nRules, translatedText } from '@/core/i18n-rules';

import type { CardErrorField } from './card-tokenizer.types';

const ENGLISH = {
  'payment.card.number.label': 'Card number',
  'payment.card.number.placeholder': 'Card Number',
  'payment.card.number.title': 'Enter your card number',
  'payment.card.number.errors.blank': 'Enter a card number',
  'payment.card.number.errors.invalid': 'Enter a valid card number',
  'payment.card.cvv.label': 'Security code',
  'payment.card.cvv.placeholder': 'CVV *',
  'payment.card.cvv.title': "Enter your card's security code",
  'payment.card.cvv.errors.blank': 'Enter the security code',
  'payment.card.cvv.errors.invalid': 'Enter a valid security code',
  'payment.card.expiry_month.errors.blank': 'Select an expiry month',
  'payment.card.expiry_month.errors.invalid': 'Select a valid expiry month',
  'payment.card.expiry_month.errors.expired':
    'This card has expired. Check the expiry date',
  'payment.card.expiry_year.errors.blank': 'Select an expiry year',
  'payment.card.expiry_year.errors.invalid': 'Select a valid expiry year',
  'payment.card.name.errors.blank': 'Enter the name on the card',
  'payment.card.errors.network':
    "Couldn't load the card form. Refresh the page and try again.",
  'payment.errors.generic': "Your card couldn't be processed. Try again.",
  'payment.card.errors.session_expired':
    'Your card details timed out. Enter them again.',
  'payment.errors.throttled': 'Wait a moment before trying again.',
} as const;

export type CardTextKey = keyof typeof ENGLISH;

/** `key` in the form's language, or `undefined` for the caller to keep its own text. */
export function translatedCardText(key: CardTextKey): string | undefined {
  const lang = addressLang();
  return translatedText(key, lang, I18nRules.getInstance().getTexts(lang));
}

/** `key` in the form's language, else its English. */
export function cardText(key: CardTextKey): string {
  return translatedCardText(key) ?? ENGLISH[key];
}

/**
 * The text of a provider's error, from the field it names, the provider's own key
 * (`errors.expired`) and whether the field was empty:
 *
 * | Field | Empty | Key |
 * |---|---|---|
 * | any | – | `errors.expired` → `expiry_month.errors.expired` |
 * | `number` / `cvv` / `month` / `year` | yes | `….errors.blank` |
 * | `number` / `cvv` / `month` / `year` | no | `….errors.invalid` |
 * | `full_name` | – | `name.errors.blank` |
 * | none | – | `payment.errors.generic` |
 */
export function cardErrorKey(
  field: CardErrorField | undefined,
  providerKey: string | undefined,
  empty: boolean
): CardTextKey {
  if (providerKey === 'errors.expired') {
    return 'payment.card.expiry_month.errors.expired';
  }
  const problem = empty ? 'blank' : 'invalid';
  switch (field) {
    case 'number':
      return `payment.card.number.errors.${problem}`;
    case 'cvv':
      return `payment.card.cvv.errors.${problem}`;
    case 'month':
      return `payment.card.expiry_month.errors.${problem}`;
    case 'year':
      return `payment.card.expiry_year.errors.${problem}`;
    case 'full_name':
      return 'payment.card.name.errors.blank';
    default:
      return 'payment.errors.generic';
  }
}

/**
 * The field a provider's `attribute` names. Spreedly reports the cardholder name as
 * `first_name` / `last_name` as well as `full_name`; all three are the one field here.
 */
export function cardErrorField(attribute: unknown): CardErrorField | undefined {
  switch (attribute) {
    case 'number':
    case 'cvv':
    case 'month':
    case 'year':
      return attribute;
    case 'full_name':
    case 'first_name':
    case 'last_name':
      return 'full_name';
    default:
      return undefined;
  }
}
