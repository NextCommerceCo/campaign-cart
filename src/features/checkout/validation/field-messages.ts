/**
 * Every message a checkout field shows: a template (`error.*`) with the field's name
 * (`label.<field>`) in it, in the form's language.
 *
 * Each comes from the page's `nextConfig.translations` for that language, then the
 * address-rules service's answer when it is in that language, then English. A sentence
 * and the name inside it are always the same language: if either is missing in it, the
 * whole sentence is English. Mixing them is how "รหัสไปรษณีย์ is required" happened.
 */

import { addressLang } from '@/core/country-service';
import { useConfigStore } from '@/state/config';

import { formatFieldName } from './field-labels';
import { hasEmoji } from './validation-patterns';

type Messages = Readonly<Record<string, string>>;

/** What this module needs from `CountryService`. */
export interface MessageSource {
  getMessages?: () => Messages;
  getMessageLabels?: (country?: string) => Messages;
  getMessagesLang?: () => string | undefined;
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
  phone: 'phone',
  address1: 'line1',
  address2: 'line2',
  city: 'city',
  province: 'state',
  postal: 'postcode',
  country: 'country',
};

/** The service's name for a checkout field: `fname` → `first_name`, `billing-postal` → `postcode`. */
export function serviceFieldName(field: string): string {
  const name = field.replace(/^billing-/, '');
  return SERVICE_FIELD[name] ?? name;
}

function interpolate(template: string, vars: Record<string, string>): string {
  return template.replace(
    /\{(\w+)\}/g,
    (match, key: string) => vars[key] ?? match
  );
}

/** The page's own texts for the form's language: `th-TH`, else `th`. */
function pageTexts(lang: string): Messages {
  const translations = useConfigStore.getState().translations;
  const code = lang.toLowerCase();
  return translations?.[code] ?? translations?.[baseOf(code)] ?? {};
}

function baseOf(lang: string): string {
  return lang.toLowerCase().split(/[-_]/)[0] ?? lang;
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
  const serviceName = serviceFieldName(field);
  const lang = addressLang();
  const page = pageTexts(lang);
  // An answer from before the service named its language was in the one asked for.
  const answered = source?.getMessagesLang?.();
  const service =
    answered === undefined || answered === baseOf(lang) ? source : undefined;

  const template = page[key] ?? service?.getMessages?.()[key];
  const label =
    page[`label.${serviceName}`] ??
    service?.getMessageLabels?.(country)[serviceName];
  const vars = { example: example ?? '' };
  if (template && label) return interpolate(template, { ...vars, label });
  return interpolate(ENGLISH[key], { ...vars, label: formatFieldName(name) });
}

/**
 * A field's label with its optional note, `{label} (optional)`, from `field.optional` in
 * `lang`, the language the label is in. The same order as {@link fieldMessage}: the page's
 * translation, then the service's when it answered in `lang`, then English for an English
 * label. With no template in the label's language the label is left bare, which reads
 * better than a note in another language.
 */
export function optionalLabel(
  source: MessageSource | undefined,
  label: string,
  lang: string
): string {
  const answered = source?.getMessagesLang?.();
  const service =
    answered === undefined || answered === baseOf(lang) ? source : undefined;
  const template =
    pageTexts(lang)['field.optional'] ??
    service?.getMessages?.()['field.optional'] ??
    (baseOf(lang) === 'en' ? '{label} (optional)' : undefined);
  return template ? interpolate(template, { label }) : label;
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
