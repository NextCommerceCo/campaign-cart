/**
 * Every message a checkout field shows, built from the address-rules service's `messages`
 * templates and `labels` (what each field is called inside a message), in the language
 * the SDK asked it in.
 *
 * A sentence and the field name inside it always come from the same place. If the
 * service has sent both, both are used; if either is missing, both are English. Mixing
 * them is how "รหัสไปรษณีย์ is required" happened.
 */

import { formatFieldName } from './field-labels';
import { hasEmoji } from './validation-patterns';

type Messages = Readonly<Record<string, string>>;

/** What this module needs from `CountryService`. */
export interface MessageSource {
  getMessages?: () => Messages;
  getMessageLabels?: (country?: string) => Messages;
}

export type MessageKey =
  | 'error.required'
  | 'error.pattern'
  | 'error.pattern.example'
  | 'error.email'
  | 'error.emoji'
  | 'error.name';

/** The service's wording in English, for when it has not answered. */
const ENGLISH: Record<MessageKey, string> = {
  'error.required': '{label} is required',
  'error.pattern': '{label} isn’t valid',
  'error.pattern.example': '{label} isn’t valid, for example {example}',
  'error.email': 'Enter a valid email address',
  'error.emoji': '{label} can’t contain emojis',
  'error.name':
    '{label} can only contain letters, spaces, hyphens and apostrophes',
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

function interpolate(template: string, vars: Record<string, string>): string {
  return template.replace(
    /\{(\w+)\}/g,
    (match, key: string) => vars[key] ?? match
  );
}

/**
 * The message `key` for `field`, e.g. `('error.required', 'postal')` → `ZIP Code is
 * required`, or `กรุณากรอกรหัสไปรษณีย์` when the service answered in Thai.
 *
 * @param country The address's country, whose word for the field is used (`ZIP Code`).
 * @param example Filled into `error.pattern.example`.
 */
export function fieldMessage(
  source: MessageSource | undefined,
  key: MessageKey,
  field: string,
  { country, example }: { country?: string; example?: string } = {}
): string {
  const name = field.replace(/^billing-/, '');
  const template = source?.getMessages?.()[key];
  const label =
    source?.getMessageLabels?.(country)[SERVICE_FIELD[name] ?? name];
  const vars = { example: example ?? '' };
  if (template && label) return interpolate(template, { ...vars, label });
  return interpolate(ENGLISH[key], { ...vars, label: formatFieldName(name) });
}

/** A postcode that fails its country's pattern, with the country's example when it has one. */
export function postalMessage(
  source: MessageSource | undefined,
  field: string,
  country: string,
  config: { postcodeExample: string | null }
): string {
  return config.postcodeExample
    ? fieldMessage(source, 'error.pattern.example', field, {
        country,
        example: config.postcodeExample,
      })
    : fieldMessage(source, 'error.pattern', field, { country });
}

/** `error.emoji` for every field of a form holding an emoji, keyed by field name. */
export function emojiErrors(
  source: MessageSource | undefined,
  values: Readonly<Record<string, unknown>> | undefined,
  country?: string
): Record<string, string> {
  const errors: Record<string, string> = {};
  for (const [field, value] of Object.entries(values ?? {})) {
    if (hasEmoji(value)) {
      errors[field] = fieldMessage(source, 'error.emoji', field, {
        ...(country ? { country } : {}),
      });
    }
  }
  return errors;
}
