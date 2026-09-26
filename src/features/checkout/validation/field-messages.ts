/**
 * Every message a checkout field shows, as a whole sentence in the form's language:
 * `Enter a ZIP Code`, `กรุณาเลือกจังหวัด`.
 *
 * Each comes from the page's `nextConfig.translations` for that language
 * (`field.<field>.errors.<error>`), then the errors the address-rules service wrote into
 * the country's rules when they are in that language, then English. A sentence is never
 * assembled from parts in two languages: "รหัสไปรษณีย์ is required" is what that did.
 */

import {
  addressLang,
  pageTranslations,
  sourceIn,
  type MessageSource,
} from '@/core/country-service';

import { formatFieldName } from './field-labels';
import { hasEmoji } from './validation-patterns';

export type { MessageSource };

/**
 * What is wrong with a value, in the service's words. `blank` is an empty field of either
 * kind: the service serves a dropdown's as `not_selected`, and it is read from there.
 */
export type MessageKey =
  | 'blank'
  | 'invalid'
  | 'invalid_characters'
  | 'contains_emoji';

/** For when neither the page nor the service has the sentence in the form's language. */
const ENGLISH: Record<MessageKey, string> = {
  blank: '{{label}} is required',
  invalid: '{{label}} isn’t valid',
  invalid_characters:
    '{{label}} can only contain letters, spaces, hyphens and apostrophes',
  contains_emoji: '{{label}} can’t contain emojis',
};

/** Checkout field name → the service's. Billing fields drop their `billing-` prefix. */
const SERVICE_FIELD: Record<string, string> = {
  fname: 'first_name',
  first_name: 'first_name',
  lname: 'last_name',
  last_name: 'last_name',
  email: 'email',
  phone: 'phone_number',
  address1: 'line1',
  address2: 'line2',
  city: 'city',
  province: 'state',
  postal: 'postcode',
  country: 'country',
};

/** The service's name for a checkout field: `fname` → `first_name`, `billing-postal` → `postcode`. */
function serviceFieldName(field: string): string {
  const name = field.replace(/^billing-/, '');
  return SERVICE_FIELD[name] ?? name;
}

function interpolate(template: string, vars: Record<string, string>): string {
  return template.replace(
    /\{\{\s*(\w+)\s*\}\}/g,
    (match, key: string) => vars[key] ?? match
  );
}

/** The keys a sentence is found under, most specific first: an empty dropdown's too. */
const errorsFor = (key: MessageKey): string[] =>
  key === 'blank' ? ['blank', 'not_selected'] : [key];

/**
 * The message `key` for `field`: `('blank', 'postal')` → `Enter a ZIP Code`, or
 * `กรุณากรอกรหัสไปรษณีย์` when the service answered in Thai.
 *
 * @param country The address's country, whose rules hold the sentence (`ZIP Code`).
 * @param example Filled into the page's `{{example}}`, and into the English fallback.
 */
export function fieldMessage(
  source: MessageSource | undefined,
  key: MessageKey,
  field: string,
  { country, example }: { country?: string; example?: string } = {}
): string {
  const serviceName = serviceFieldName(field);
  const lang = addressLang();
  const page = pageTranslations(lang);
  const service = sourceIn(source, lang)?.getFieldErrors?.(country)[
    serviceName
  ];

  for (const error of errorsFor(key)) {
    const own = page[`field.${serviceName}.errors.${error}`];
    if (own) return interpolate(own, { example: example ?? '' });
  }
  for (const error of errorsFor(key)) {
    const served = service?.[error];
    if (served) return served;
  }

  const english =
    key === 'invalid' && serviceName === 'email'
      ? 'Enter a valid email address'
      : key === 'invalid' && example
        ? '{{label}} isn’t valid, for example {{example}}'
        : ENGLISH[key];
  return interpolate(english, {
    label: formatFieldName(field.replace(/^billing-/, '')),
    example: example ?? '',
  });
}

/** A postcode that fails its country's pattern, with the country's example when it has one. */
export function postalMessage(
  source: MessageSource | undefined,
  field: string,
  country: string,
  config: { postcodeExample: string | null }
): string {
  return fieldMessage(source, 'invalid', field, {
    country,
    ...(config.postcodeExample ? { example: config.postcodeExample } : {}),
  });
}

/** `contains_emoji` for every field of a form holding an emoji, keyed by field name. */
export function emojiErrors(
  source: MessageSource | undefined,
  values: Readonly<Record<string, unknown>> | undefined,
  country?: string
): Record<string, string> {
  const errors: Record<string, string> = {};
  for (const [field, value] of Object.entries(values ?? {})) {
    if (hasEmoji(value)) {
      errors[field] = fieldMessage(source, 'contains_emoji', field, {
        ...(country ? { country } : {}),
      });
    }
  }
  return errors;
}
