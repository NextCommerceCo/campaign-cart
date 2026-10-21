import { RulesApi } from '../../src/engine/rules';
import type { CountryRules } from '../../src/engine/types';
import { json } from './api';

export const US: CountryRules = {
  country: { code: 'US', name: 'United States' },
  fields: {
    state: { required: true, errors: { not_selected: 'Select a state' } },
    postcode: { required: true, format: { pattern: '^[0-9]{5}([0-9]{4})?$' }, errors: { invalid: 'Enter a ZIP Code' } },
  },
  states: [
    { code: 'CA', name: 'California' },
    { code: 'NY', name: 'New York' },
  ],
};

export const GB: CountryRules = {
  country: { code: 'GB', name: 'United Kingdom' },
  fields: { postcode: { required: true, format: { pattern: '^[A-Z]{1,2}[0-9][A-Z0-9]?[0-9][A-Z]{2}$' } } },
};

const COUNTRIES = [
  { code: 'US', name: 'United States' },
  { code: 'GB', name: 'United Kingdom' },
  { code: 'FR', name: 'France' },
];

export function fakeRules(options: { geo?: string; down?: boolean } = {}) {
  const calls: string[] = [];
  const send = async (url: string, init: RequestInit) => {
    const path = url.replace('https://rules.test', '');
    calls.push(`${init.method} ${path}`);
    if (options.down) return json({}, 503);
    if (path.startsWith('/v1/countries?')) return json(COUNTRIES);
    if (path.startsWith('/v1/countries/US')) return json(US);
    if (path.startsWith('/v1/countries/GB')) return json(GB);
    if (path.startsWith('/v1/countries/')) return json({ country: { code: 'FR', name: 'France' }, fields: {} });
    if (path.startsWith('/v1/geo')) {
      const code = options.geo ?? 'GB';
      return json({ country: { code, name: code }, rules: code === 'GB' ? GB : US });
    }
    const { fields } = JSON.parse(String(init.body));
    if (fields.phone_number) return json({ fields: { phone_number: { valid: true, value: '+14155552671' } } });
    const wrongState = fields.postcode === '10001' && fields.state === 'CA';
    return json({
      fields: {
        postcode: wrongState
          ? { valid: false, error: { code: 'not_in_state', message: 'Enter a valid ZIP Code for California' } }
          : { valid: true },
      },
    });
  };
  return { calls, api: new RulesApi(send, 'https://rules.test', 'en') };
}
