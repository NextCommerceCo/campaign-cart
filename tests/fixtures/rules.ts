import { RulesApi } from '../../src/engine/rules';
import type { CountryRules } from '../../src/engine/types';
import { json } from './api';

export const US: CountryRules = {
  country: { code: 'US', name: 'United States' },
  address: {
    layout: [
      ['country'],
      ['first_name', 'last_name'],
      ['line1'],
      ['line2'],
      ['city', 'state', 'postcode'],
      ['phone_number'],
    ],
  },
  fields: {
    city: { required: true, label: 'City' },
    state: {
      required: true,
      label: 'State',
      input: { type: 'select', placeholder: 'Choose…' },
      errors: { not_selected: 'Select a state' },
    },
    postcode: {
      required: true,
      label: 'ZIP Code',
      input: { type: 'text', auto_capitalize: 'characters', max_length: 64 },
      format: { pattern: '^[0-9]{5}([0-9]{4})?$', example: '90210', masks: ['#####', '#####-####'] },
      errors: { invalid: 'Enter a ZIP Code' },
    },
    phone_number: {
      required: false,
      label: 'Phone number',
      format: {
        calling_code: '1',
        national_prefix: '1',
        masks: [{ mask: '(###) ###-####' }],
        pattern: '^[0-9]{10,11}$',
        example: '(201) 555-0123',
      },
    },
  },
  states: [
    { code: 'CA', name: 'California' },
    { code: 'NY', name: 'New York' },
    { code: 'PR', name: 'Puerto Rico' },
  ],
};

export const GB: CountryRules = {
  country: { code: 'GB', name: 'United Kingdom' },
  address: {
    layout: [['country'], ['first_name', 'last_name'], ['line1'], ['line2'], ['city', 'postcode'], ['phone_number']],
  },
  fields: {
    city: { required: true, label: 'Town/City' },
    postcode: {
      required: true,
      label: 'Postcode',
      format: { pattern: '^[A-Z]{1,2}[0-9][A-Z0-9]?[0-9][A-Z]{2}$', example: 'SW1A 1AA' },
    },
  },
};

export const HK: CountryRules = {
  country: { code: 'HK', name: 'Hong Kong' },
  fields: {
    city: { required: true, label: 'City', label_optional: 'City (optional)' },
    state: {
      required: true,
      label: 'Region',
      label_optional: 'Region (optional)',
      input: { type: 'text', auto_capitalize: 'words', max_length: 255 },
    },
  },
};

export const SG: CountryRules = {
  country: { code: 'SG', name: 'Singapore' },
  fields: {
    postcode: {
      required: true,
      label: 'Postal code',
      input: { type: 'text', auto_capitalize: 'characters', max_length: 64 },
      format: { pattern: '^([0-9]{2}|[0-9]{4}|[0-9]{6})$', example: '018956' },
    },
  },
};

export const CA: CountryRules = {
  country: { code: 'CA', name: 'Canada' },
  fields: {
    city: { required: true, label: 'City' },
    state: { required: true, label: 'Province', input: { type: 'select', placeholder: 'Choose…' } },
    postcode: {
      required: true,
      label: 'Postal code',
      input: { type: 'text', auto_capitalize: 'characters', max_length: 64 },
      format: { pattern: '^[A-Z][0-9][A-Z][0-9][A-Z][0-9]$', example: 'K1A 0B1', masks: ['### ###'] },
    },
  },
  states: [
    { code: 'AB', name: 'Alberta' },
    { code: 'BC', name: 'British Columbia' },
  ],
};

export const TH: CountryRules = {
  country: { code: 'TH', name: 'Thailand' },
  fields: {
    city: { required: true, label: 'District' },
    phone_number: {
      required: false,
      label: 'Phone number',
      format: {
        calling_code: '66',
        national_prefix: '0',
        masks: [
          { start: '02', mask: '## ### ####' },
          { start: '0[3-57]', mask: '### ### ###' },
          { start: '1', mask: '#### ### ###' },
          { mask: '### ### ####' },
        ],
        pattern: '^[0-9]{8,14}$',
        example: '081 234 5678',
      },
    },
  },
};

const US_PHONE = {
  valid: true,
  value: '+14155552671',
  country: 'US',
  national: '(415) 555-2671',
  international: '+1 415 555 2671',
};
const TH_PHONE = {
  valid: true,
  value: '+66812345678',
  country: 'TH',
  national: '081 234 5678',
  international: '+66 81 234 5678',
};

function readPhone(country: string, typed: string) {
  const key = typed.replace(/[^\d+]/g, '');
  if (key === '+66812345678' || (country === 'TH' && key === '0812345678')) return TH_PHONE;
  if (key === '+14155552671' || (country !== 'TH' && ['4155552671', '14155552671'].includes(key))) return US_PHONE;
  const example = country === 'TH' ? '081 234 5678' : '(201) 555-0123';
  return { valid: false, error: { code: 'invalid', message: `Enter a valid phone number, like ${example}` } };
}

const COUNTRIES = [
  { code: 'US', name: 'United States' },
  { code: 'GB', name: 'United Kingdom' },
  { code: 'FR', name: 'France' },
  { code: 'CA', name: 'Canada' },
  { code: 'HK', name: 'Hong Kong' },
  { code: 'SG', name: 'Singapore' },
];

export function fakeRules(options: { geo?: string; down?: boolean; geoDelay?: number } = {}) {
  const calls: string[] = [];
  const send = async (url: string, init: RequestInit) => {
    const path = url.replace(/^https:\/\/[^/]+/, '');
    calls.push(`${init.method} ${path}`);
    if (options.down) return json({}, 503);
    if (path.startsWith('/v1/countries?')) return json(COUNTRIES);
    if (path.startsWith('/v1/countries/US')) return json(US);
    if (path.startsWith('/v1/countries/GB')) return json(GB);
    if (path.startsWith('/v1/countries/TH')) return json(TH);
    if (path.startsWith('/v1/countries/HK')) return json(HK);
    if (path.startsWith('/v1/countries/SG')) return json(SG);
    if (path.startsWith('/v1/countries/CA')) return json(CA);
    if (path.startsWith('/v1/countries/')) return json({ country: { code: 'FR', name: 'France' }, fields: {} });
    if (path.startsWith('/v1/geo')) {
      if (options.geoDelay) await new Promise((r) => setTimeout(r, options.geoDelay));
      const code = options.geo ?? 'GB';
      return json({ country: { code, name: code }, rules: code === 'GB' ? GB : US });
    }
    const { country, fields } = JSON.parse(String(init.body));
    if (fields.phone_number) return json({ fields: { phone_number: readPhone(country, fields.phone_number) } });
    const wrongState = fields.postcode === '10001' && fields.state === 'CA';
    return json({
      fields: {
        postcode: wrongState
          ? { valid: false, error: { code: 'not_in_state', message: 'Enter a valid ZIP Code for California' } }
          : { valid: true },
      },
    });
  };
  return { calls, send, api: new RulesApi(send, 'https://rules.test', 'en') };
}
