import { asciiDigits, plausiblePhone } from './phone';
import type { CheckoutState, CountryOption, CountryRules, FieldError, FieldFormat, Send } from './types';

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
  ) {}

  countries(): Promise<CountryOption[]> {
    return this.get(`/v1/countries?lang=${this.lang}`);
  }

  country(code: string): Promise<CountryRules> {
    return this.get(`/v1/countries/${code}?include=states&lang=${this.lang}`);
  }

  geo(): Promise<{ country: CountryOption | null; rules?: CountryRules }> {
    return this.get(`/v1/geo?include=rules,states&lang=${this.lang}`);
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

export type Scope = 'express' | 'shipping' | 'all';

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

const ALWAYS_REQUIRED = ['first_name', 'last_name', 'line1'];
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

function addressFields(prefix: '' | 'billing_', rules: CountryRules | undefined): string[] {
  const byCountry = BY_COUNTRY.filter((name) => (rules ? rules.fields[name]?.required : name === 'city'));
  const names = [...ALWAYS_REQUIRED, ...byCountry, 'country'];
  return names.map((n) => prefix + n);
}

export function requiredFields(checkout: CheckoutState, scope: Scope, phoneRequired = false): string[] {
  if (scope === 'express') return ['email', 'first_name', 'last_name'];
  const { fields, rules, sameAsShipping } = checkout;
  const names = ['email', ...addressFields('', rules[fields.country ?? ''])];
  if (phoneRequired) names.push('phone_number');
  if (scope === 'all' && !sameAsShipping) names.push(...addressFields('billing_', rules[fields.billing_country ?? '']));
  return names;
}

export function formErrors(checkout: CheckoutState, scope: Scope, phoneRequired = false): Record<string, FieldError> {
  const required = requiredFields(checkout, scope, phoneRequired);
  const { fields, rules, sameAsShipping } = checkout;
  const names = new Set([...required, ...Object.keys(fields)]);
  const errors: Record<string, FieldError> = {};
  for (const name of names) {
    const billing = name.startsWith('billing_');
    if (billing && (sameAsShipping || scope !== 'all')) continue;
    if (scope === 'express' && !required.includes(name)) continue;
    if (checkout.phones[name]) continue;
    const country = rules[(billing ? fields.billing_country : fields.country) ?? ''];
    if (!hasField(country, name)) continue;
    const error = fieldError(name, fields[name] ?? '', required.includes(name), country);
    if (error) errors[name] = error;
  }
  return errors;
}
