import { asciiDigits, countryOf, plausiblePhone } from './phone';
import { askGeo, type VisitorGeo } from '../../engine/geo';
import { fill, type Texts } from '../../engine/texts';
import type { Send } from '../../engine/types';
import type { CheckoutState, CountryOption, CountryRules, FieldError, FieldFormat, FieldRule } from './types';

export interface RemoteCheck {
  valid: boolean | null;
  value?: string;
  country?: string;
  national?: string;
  international?: string;
  error?: { code: string; message: string };
}

export class RulesApi {
  constructor(
    private send: Send,
    private base: string,
    private lang: string,
    private page: Texts = {},
  ) {}

  countries(): Promise<CountryOption[]> {
    return this.get(`/v1/countries?lang=${this.lang}`);
  }

  async country(code: string): Promise<CountryRules> {
    return withPageTexts(await this.get(`/v1/countries/${code}?include=states&lang=${this.lang}`), this.page);
  }

  geo(): Promise<VisitorGeo | undefined> {
    return askGeo(this.send, this.lang, this.base);
  }

  async validate(
    country: string,
    fields: Record<string, string>,
    timeoutMs = 4000,
  ): Promise<Record<string, RemoteCheck>> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await this.send(`${this.base}/v1/validate?lang=${this.lang}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ country, fields }),
        signal: controller.signal,
      });
      if (!res.ok) throw new Error(`validate → ${res.status}`);
      return ((await res.json()) as { fields: Record<string, RemoteCheck> }).fields;
    } finally {
      clearTimeout(timer);
    }
  }

  private async get<T>(path: string): Promise<T> {
    const res = await this.send(`${this.base}${path}`, { method: 'GET' });
    if (!res.ok) throw new Error(`GET ${path} → ${res.status}`);
    return (await res.json()) as T;
  }
}

const EMPTY: FieldError[] = ['blank', 'not_selected'];

function withPageText(name: string, rule: FieldRule, page: Texts): FieldRule {
  const own: Record<string, string> = {};
  for (const prefix of [`fields.${name}.`, rule.label_id && `${rule.label_id}.`].filter(Boolean) as string[])
    for (const [key, text] of Object.entries(page)) if (key.startsWith(prefix)) own[key.slice(prefix.length)] = text;
  const vars = { example: rule.format?.example, max: rule.input?.max_length };
  const errors = { ...rule.errors };
  for (const [part, text] of Object.entries(own)) {
    const code = /^errors\.(\w+)$/.exec(part)?.[1] as FieldError | undefined;
    if (code) errors[code] = fill(text, vars);
  }
  const empty = EMPTY.map((code) => own[`errors.${code}`]).find(Boolean);
  for (const code of EMPTY) if (empty && !own[`errors.${code}`]) errors[code] = fill(empty, vars);
  return { ...rule, label: own.label ?? rule.label, label_optional: own.label_optional ?? rule.label_optional, errors };
}

/** The page's `translations` over a country's rules: by the field's `label_id` (`fields.postcode.zip_code.label`), else its name. */
export function withPageTexts(rules: CountryRules, page: Texts): CountryRules {
  if (!Object.keys(page).length) return rules;
  const fields = Object.fromEntries(
    Object.entries(rules.fields).map(([name, rule]) => [name, rule && withPageText(name, rule, page)]),
  );
  return { ...rules, fields };
}

export type Scope = 'shipping' | 'all' | string[];

const EMAIL = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?$/;
const NAME = /^[\p{L}\p{M}\s'’.-]+$/u;
const EMOJI = /\p{Extended_Pictographic}/u;
const SELECTS = ['country', 'state'];

export function validEmail(value: string): boolean {
  const [local = '', domain = ''] = value.split('@');
  return (
    EMAIL.test(value) &&
    !value.includes('..') &&
    !/^\.|\.$/.test(local) &&
    !/^\.|\.$/.test(domain) &&
    (domain.split('.').pop() ?? '').length >= 2
  );
}

const base = (name: string) => name.replace(/^billing_/, '');

export const BY_COUNTRY = ['city', 'state', 'postcode'];

export const hasField = (rules: CountryRules | undefined, name: string) =>
  !rules || !BY_COUNTRY.includes(base(name)) || !!rules.fields[base(name)];

const significant = (text: string) =>
  asciiDigits(text)
    .toUpperCase()
    .replace(/[^\p{L}\p{N}]/gu, '');

export function formatPostcode(text: string, format?: FieldFormat): string {
  const clean = significant(text);
  for (const mask of format?.masks ?? []) {
    if (typeof mask !== 'string' || mask.split('#').length - 1 !== clean.length) continue;
    if (format?.pattern && !new RegExp(format.pattern).test(clean)) continue;
    let i = 0;
    return [...mask].map((char) => (char === '#' ? clean[i++] : char)).join('');
  }
  return asciiDigits(text).toUpperCase();
}

export function fieldError(
  name: string,
  value: string,
  required: boolean,
  rules?: CountryRules,
): FieldError | undefined {
  const v = value.trim();
  const field = base(name);
  const rule = rules?.fields[field];
  if (!v) return required ? (SELECTS.includes(field) ? 'not_selected' : 'blank') : undefined;
  if (EMOJI.test(v)) return 'contains_emoji';
  if (rule?.input?.max_length && v.length > rule.input.max_length) return 'too_long';
  if (field === 'email') return validEmail(v) ? undefined : 'invalid';
  if (field === 'first_name' || field === 'last_name') return NAME.test(v) ? undefined : 'invalid_characters';
  if (field === 'postcode' && rule?.format?.pattern) {
    return new RegExp(rule.format.pattern).test(significant(v)) ? undefined : 'invalid';
  }
  if (field === 'phone_number') return plausiblePhone(v, rule?.format) ? undefined : 'invalid';
  return undefined;
}

export const addressRequired = (rules: CountryRules | undefined): string[] => [
  'line1',
  ...BY_COUNTRY.filter((name) => (rules ? rules.fields[name]?.required : name === 'city')),
];

function addressFields(prefix: '' | 'billing_', rules: CountryRules | undefined): string[] {
  const names = ['first_name', 'last_name', ...addressRequired(rules), 'country'];
  return names.map((n) => prefix + n);
}

export function requiredFields(checkout: CheckoutState, scope: Scope, phoneRequired = false): string[] {
  if (Array.isArray(scope)) return scope;
  const { fields, rules, sameAsShipping } = checkout;
  const names = ['email', ...addressFields('', rules[fields.country ?? ''])];
  if (phoneRequired) names.push('phone_number');
  if (scope === 'all' && !sameAsShipping) names.push(...addressFields('billing_', rules[fields.billing_country ?? '']));
  return names;
}

const ADDRESS = ['first_name', 'last_name', 'line1', 'line2', ...BY_COUNTRY, 'country', 'phone_number'];

export function addressValid(checkout: CheckoutState, prefix: '' | 'billing_'): boolean {
  const country = checkout.fields[`${prefix}country`];
  if (!country || (!checkout.rules[country] && !checkout.rulesDown)) return false;
  const errors = formErrors(checkout, 'all');
  return ADDRESS.every((name) => !errors[prefix + name]);
}

export function formErrors(checkout: CheckoutState, scope: Scope, phoneRequired = false): Record<string, FieldError> {
  const required = requiredFields(checkout, scope, phoneRequired);
  const { fields, rules, sameAsShipping } = checkout;
  const names = new Set([...required, ...Object.keys(fields)]);
  const errors: Record<string, FieldError> = {};
  for (const name of names) {
    const billing = name.startsWith('billing_');
    if (Array.isArray(scope) ? !scope.includes(name) : billing && (sameAsShipping || scope !== 'all')) continue;
    if (checkout.phones[name]) continue;
    const country = rules[countryOf(fields, name) ?? ''];
    if (!hasField(country, name)) continue;
    const error = fieldError(name, fields[name] ?? '', required.includes(name), country);
    if (error) errors[name] = error;
  }
  return errors;
}

const postcodeBasis = (fields: CheckoutState['fields']) =>
  [fields.country, fields.state, fields.postcode?.trim()].join('|');

export function postcodeChecked(checkout: CheckoutState, asked: CheckoutState['fields'], result?: RemoteCheck) {
  const { postcode: shown, ...errors } = checkout.errors;
  if (!result || postcodeBasis(checkout.fields) !== postcodeBasis(asked) || (shown && !shown.warning)) return;
  if (result.error) return { ...errors, postcode: { ...result.error, warning: true } };
  return shown && errors;
}
