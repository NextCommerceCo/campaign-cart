import type { CheckoutError, CountryRules } from '../engine/types';

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

export function label(name: string, rules?: CountryRules): string {
  const base = name.replace(/^billing_/, '');
  const text = rules?.fields[base]?.label ?? LABELS[base] ?? base;
  return name.startsWith('billing_') ? `Billing ${text.charAt(0).toLowerCase()}${text.slice(1)}` : text;
}

export function fieldText(name: string, error: CheckoutError, rules?: CountryRules): string {
  if (error.message) return error.message;
  const base = name.replace(/^billing_/, '');
  const served = (rules?.fields[base]?.errors as Record<string, string> | undefined)?.[error.code];
  if (served) return served;
  if (base === 'email' && error.code === 'invalid') return 'Enter a valid email address';
  return (FIELD[error.code] ?? FIELD.invalid!).replace('{label}', label(name, rules));
}

export function formText(error: CheckoutError, fill: Record<string, string> = {}): string {
  const text = error.message ?? FORM[error.code] ?? FORM.failed!;
  return Object.entries(fill).reduce((t, [k, v]) => t.replace(`{${k}}`, v), text);
}

export const expressText = (message: string) => FORM.express!.replace('{message}', message.replace(/\.$/, ''));
