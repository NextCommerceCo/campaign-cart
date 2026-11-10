import type { Texts } from '../../engine/display/texts';
import type { CheckoutError } from '../../engine/types';
import type { CheckoutState, CountryRules } from '../state/types';
import { parse, rulesOf, toV2 } from './names';

const LABELS: Record<string, string> = {
  email: 'Email',
  first_name: 'First name',
  last_name: 'Last name',
  line1: 'Address',
  line2: 'Address line 2',
  city: 'City',
  state: 'State or province',
  postcode: 'Postal code',
  country: 'Country',
  phone_number: 'Phone number',
  number: 'Card number',
  cvv: 'Security code',
  month: 'Expiration month',
  year: 'Expiration year',
  expiry: 'Expiration date',
};

const FIELD: Record<string, string> = {
  blank: '{label} is required',
  not_selected: '{label} is required',
  invalid: '{label} isn’t valid',
  invalid_characters: '{label} can only contain letters, spaces, hyphens and apostrophes',
  contains_emoji: '{label} can’t contain emojis',
  too_long: '{label} is too long',
  expired: 'Card has expired',
};

const CARD: Record<string, string> = {
  number: 'Enter a valid card number',
  cvv: 'Enter a valid security code',
  month: 'Select an expiry month',
  year: 'Select an expiry year',
  expiry: 'Enter the expiry date as MM / YY',
  expired: 'This card has expired. Check the expiry date',
};

const FORM: Record<string, string> = {
  declined: 'Your card couldn’t be processed. Try again.',
  too_many_requests: 'Too many requests. Please wait a moment and try again.',
  auth: 'Authentication error. Please refresh the page and try again.',
  invalid_order: 'Invalid order data. Please check your details and try again.',
  server: 'Server error. Please try again in a moment.',
  failed: 'Failed to process order. Please try again.',
  card: 'Please check your card details and try again.',
  card_expired: 'Your card details timed out. Enter them again.',
  empty_cart: 'Your cart is empty.',
  unshown: 'Please check the following fields: {fields}',
  express: '{message}. Please try a different payment method.',
};

const REFUSED: Record<string, string> = {
  lines: 'An item in your order isn’t available right now. Please contact support.',
  shipping_address: 'Please check your shipping address and try again.',
  billing_address: 'Please check your billing address and try again.',
  user: 'Please check your contact details and try again.',
  payment_detail: 'We couldn’t process that payment method. Please try another.',
  generic: 'We couldn’t place your order. Please try again or contact support.',
};

const CARD_KEYS: Record<string, string> = {
  number: 'payment.card.number.errors.invalid',
  cvv: 'payment.card.cvv.errors.invalid',
  month: 'payment.card.expiry_month.errors.blank',
  year: 'payment.card.expiry_year.errors.blank',
  expired: 'payment.card.expiry_month.errors.expired',
};

const CARD_FIELDS: Record<string, string> = {
  number: 'number',
  cvv: 'cvv',
  month: 'expiry_month',
  year: 'expiry_year',
};

const FORM_KEYS: Record<string, string> = { card_expired: 'payment.card.errors.session_expired' };

let page: Texts = {};
let service: Texts | undefined;
let loading: Promise<unknown> | undefined;

/** The page's `translations` in the form's language, and i18n-rules' texts once they load: read before the English here. */
export function useTexts(own: Texts, served: Promise<Texts | undefined>): void {
  page = own;
  service = undefined;
  loading = served;
  void served.then((texts) => {
    if (loading === served) service = texts;
  });
}

/** `key` in the form's language, else `english`. */
export const textOf = (key: string | undefined, english: string): string =>
  (key && (page[key] ?? service?.[key])) || english;

export function label(name: string, rules?: CountryRules): string {
  const { billing, api: base } = parse(name);
  const text = rules?.fields[base]?.label ?? page[`fields.${base}.label`] ?? LABELS[base] ?? base;
  return billing ? `Billing ${text.charAt(0).toLowerCase()}${text.slice(1)}` : text;
}

export function fieldText(name: string, error: CheckoutError, rules?: CountryRules): string {
  if (error.message) return error.message;
  const base = parse(name).api;
  const served =
    (rules?.fields[base]?.errors as Record<string, string> | undefined)?.[error.code] ??
    page[`fields.${base}.errors.${error.code}`];
  if (served) return served;
  if (base === 'email' && error.code === 'invalid') return 'Enter a valid email address';
  return (FIELD[error.code] ?? FIELD.invalid!).replace('{label}', label(name, rules));
}

const declineText = (error: CheckoutError) =>
  textOf(error.decline && `payment.errors.${error.decline}`, textOf('payment.errors.generic', FORM.declined!));

const refusedOrder = (field: string) =>
  textOf(`order.errors.${field}`, REFUSED[field] ?? textOf('order.errors.generic', REFUSED.generic!));

export function formText(error: CheckoutError, fill: Record<string, string> = {}): string {
  const text =
    error.code === 'declined'
      ? declineText(error)
      : error.field
        ? refusedOrder(error.field)
        : (error.message ?? textOf(FORM_KEYS[error.code], FORM[error.code] ?? FORM.failed!));
  return Object.entries(fill).reduce((t, [k, v]) => t.replace(`{${k}}`, v), text);
}

/** `checkout.errors` as a page reads it: each field's message under its name and key, and `payment`, the error box's. */
export function errorTexts(state: CheckoutState, payment: string): Record<string, string> {
  const texts: Record<string, string> = {};
  for (const [name, error] of Object.entries(state.errors)) {
    if (name === 'form') continue;
    texts[name] = texts[toV2(name)] = fieldText(name, error, rulesOf(state, name));
  }
  if (payment) texts.payment = payment;
  return texts;
}

export const cardText = (problem: string) => textOf(CARD_KEYS[problem], CARD[problem]!);

/** What payment.js refused in a card field without saying why. */
export const refusedText = (field: string) =>
  textOf(`payment.card.${CARD_FIELDS[field]}.errors.invalid`, `Please enter a valid ${label(field).toLowerCase()}`);

export const expressText = (message: string) => FORM.express!.replace('{message}', message.replace(/\.$/, ''));
