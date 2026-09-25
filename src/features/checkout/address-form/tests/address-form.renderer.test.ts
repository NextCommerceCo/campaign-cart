import { beforeEach, describe, expect, it } from 'vitest';

import type { RulesField } from '@/core/country-service';

import {
  contactLayout,
  readRenderedValues,
  renderLayout,
  sdkFieldName,
} from '../address-form.renderer';

/** One layout of a country's rules, with the fields it names. */
interface Spec {
  country: string;
  layout: string[][];
  fields: Record<string, RulesField | undefined>;
}

const render = (
  target: HTMLElement,
  spec: Spec,
  ctx: Parameters<typeof renderLayout>[3]
) => renderLayout(target, spec.layout, spec.fields, ctx);

const text = (
  label: string,
  autocomplete: string,
  input: Partial<RulesField['input']> = {}
): RulesField => ({
  label,
  required: true,
  autocomplete,
  input: { type: 'text', ...input },
});

const select = (
  label: string,
  autocomplete: string,
  options: 'countries' | 'states'
): RulesField => text(label, autocomplete, { type: 'select', options });

const US: Spec = {
  country: 'US',
  layout: [['country'], ['line1'], ['city', 'state', 'postcode']],
  fields: {
    country: select('Country', 'country', 'countries'),
    line1: text('Address', 'address-line1'),
    city: text('City', 'address-level2'),
    state: select('State', 'address-level1', 'states'),
    postcode: text('ZIP Code', 'postal-code', { maxLength: 10 }),
  },
};

const JP: Spec = {
  country: 'JP',
  layout: [['country'], ['postcode', 'state'], ['city'], ['line1']],
  fields: {
    country: select('Country', 'country', 'countries'),
    postcode: text('郵便番号', 'postal-code'),
    state: select('都道府県', 'address-level1', 'states'),
    city: text('市区町村', 'address-level2'),
    line1: text('番地', 'address-line1'),
  },
};

const TH: Spec = {
  country: 'TH',
  layout: [['country'], ['line1'], ['line3'], ['city'], ['postcode']],
  fields: {
    country: select('Country', 'country', 'countries'),
    line1: text('Address', 'address-line1'),
    line3: text('Sub-district', 'address-level3'),
    city: text('District', 'address-level2'),
    postcode: text('Postcode', 'postal-code'),
  },
};

/** The same layout with the name row a page may collect in a step of its own. */
const US_WITH_NAME: Spec = {
  ...US,
  layout: [
    ['country'],
    ['first_name', 'last_name'],
    ['line1'],
    ['city', 'state', 'postcode'],
  ],
  fields: {
    ...US.fields,
    first_name: text('First name', 'given-name'),
    last_name: text('Last name', 'family-name'),
  },
};

let container: HTMLElement;

beforeEach(() => {
  container = document.createElement('div');
  document.body.append(container);
});

describe('contactLayout', () => {
  it('writes the name as the address layout does, then the email and the phone', () => {
    const jp = [['country'], ['last_name', 'first_name'], ['line1'], ['phone_number']];
    expect(contactLayout(jp, false)).toEqual([
      ['last_name', 'first_name'],
      ['email'],
      ['phone_number'],
    ]);
  });

  it('keeps only the email beside a shipping address, which has the name and phone', () => {
    const us = [['country'], ['first_name', 'last_name'], ['line1']];
    expect(contactLayout(us, true)).toEqual([['email']]);
  });

  it('asks for the name even where the address layout has no name row', () => {
    expect(contactLayout([['country'], ['line1']], false)[0]).toEqual([
      'first_name',
      'last_name',
    ]);
  });
});

describe('sdkFieldName', () => {
  it.each([
    ['line1', 'address1'],
    ['line2', 'address2'],
    ['state', 'province'],
    ['postcode', 'postal'],
    ['phone_number', 'phone'],
    ['email', 'email'],
    ['first_name', 'fname'],
  ])('maps %s to this SDK’s %s', (from, to) => {
    expect(sdkFieldName(from, 'shipping')).toBe(to);
  });

  it('prefixes a billing field', () => {
    expect(sdkFieldName('line1', 'billing')).toBe('billing-address1');
  });

  it('maps line3 to nothing', () => {
    expect(sdkFieldName('line3', 'shipping')).toBeNull();
  });
});

describe('renderLayout', () => {
  it('builds the fields the layout names, in layout order', () => {
    const rendered = render(container, US, { form: 'shipping' });

    expect(rendered).toEqual([
      'country',
      'address1',
      'city',
      'province',
      'postal',
    ]);
  });

  it('puts a country’s fields where that country writes them', () => {
    const rendered = render(container, JP, { form: 'shipping' });

    expect(rendered).toEqual([
      'country',
      'postal',
      'province',
      'city',
      'address1',
    ]);
    const secondRow = container.querySelector('[data-next-address-row="1"]');
    expect(
      [...(secondRow?.querySelectorAll('[data-next-address-field]') ?? [])].map(
        cell => cell.getAttribute('data-next-address-field')
      )
    ).toEqual(['postal', 'province']);
  });

  it('marks every control as a checkout field', () => {
    render(container, US, { form: 'shipping' });

    const fields = [
      ...container.querySelectorAll('[data-next-checkout-field]'),
    ].map(el => el.getAttribute('data-next-checkout-field'));
    expect(fields).toEqual([
      'country',
      'address1',
      'city',
      'province',
      'postal',
    ]);
  });

  it('prefixes autocomplete with the form it belongs to', () => {
    render(container, US, { form: 'shipping' });

    expect(
      container
        .querySelector('[data-next-checkout-field="address1"]')
        ?.getAttribute('autocomplete')
    ).toBe('shipping address-line1');
  });

  it('builds a select for a field whose options another part of the SDK fills', () => {
    render(container, US, { form: 'shipping' });

    const province = container.querySelector(
      '[data-next-checkout-field="province"]'
    );
    expect(province?.tagName).toBe('SELECT');
    expect(province?.children).toHaveLength(0);
  });

  it('leaves out a field this SDK does not collect, and the rest of its row stands', () => {
    const rendered = render(container, TH, { form: 'shipping' });

    expect(rendered).not.toContain('line3');
    expect(rendered).toEqual(['country', 'address1', 'city', 'postal']);
  });

  it('does not build a field the page already collects elsewhere', () => {
    const rendered = render(container, US_WITH_NAME, {
      form: 'shipping',
      alreadyCollected: new Set(['fname', 'lname']),
    });

    expect(rendered).toEqual([
      'country',
      'address1',
      'city',
      'province',
      'postal',
    ]);
    expect(
      container.querySelector('[data-next-checkout-field="fname"]')
    ).toBeNull();
  });

  it('drops the row entirely when every field on it is collected elsewhere', () => {
    render(container, US_WITH_NAME, {
      form: 'shipping',
      alreadyCollected: new Set(['fname', 'lname']),
    });

    const rows = [...container.querySelectorAll('[data-next-address-row]')].map(
      r => r.getAttribute('data-next-address-row')
    );
    expect(rows).not.toContain('1');
  });

  it('builds a field once even when the layout names it twice', () => {
    const twice: Spec = {
      ...US,
      layout: [['country'], ['line1'], ['line1'], ['city']],
    };

    const rendered = render(container, twice, { form: 'shipping' });

    expect(rendered).toEqual(['country', 'address1', 'city']);
    expect(
      container.querySelectorAll('[data-next-checkout-field="address1"]')
    ).toHaveLength(1);
  });

  it('replaces the previous country’s fields rather than adding to them', () => {
    render(container, US, { form: 'shipping' });
    render(container, JP, { form: 'shipping' });

    expect(
      container.querySelectorAll('[data-next-checkout-field]')
    ).toHaveLength(5);
    expect(
      container.querySelector('[data-next-address-row="2"]')?.textContent
    ).toContain('市区町村');
  });

  it('puts back what the shopper had typed', () => {
    render(container, US, {
      form: 'shipping',
      values: { address1: '1 Test Street', city: 'Testville' },
    });

    expect(
      container.querySelector<HTMLInputElement>(
        '[data-next-checkout-field="address1"]'
      )?.value
    ).toBe('1 Test Street');
  });

  it('wraps every field in .form-group, which the SDK queries for', () => {
    render(container, US, { form: 'shipping' });

    expect(container.querySelectorAll('.form-group')).toHaveLength(5);
    expect(
      container
        .querySelector('[data-next-address-field="province"]')
        ?.classList.contains('form-group')
    ).toBe(true);
  });

  it('builds billing-prefixed fields for a billing block', () => {
    const rendered = render(container, US, { form: 'billing' });

    expect(rendered).toEqual([
      'billing-country',
      'billing-address1',
      'billing-city',
      'billing-province',
      'billing-postal',
    ]);
    expect(
      container
        .querySelector('[data-next-checkout-field="billing-address1"]')
        ?.getAttribute('autocomplete')
    ).toBe('billing address-line1');
  });

  it('falls the placeholder back to the label, so an empty box is never blank', () => {
    render(container, US, { form: 'shipping' });

    expect(
      container.querySelector<HTMLInputElement>(
        '[data-next-checkout-field="city"]'
      )?.placeholder
    ).toBe('City');
  });

  it('writes the optional note on a field that is not required, and only there', () => {
    const withLine2: Spec = {
      ...US,
      layout: [['line1'], ['line2']],
      fields: {
        ...US.fields,
        line2: {
          ...text('Apartment, suite, etc.', 'address-line2'),
          required: false,
        },
      },
    };
    render(container, withLine2, {
      form: 'shipping',
      optionalLabel: label => `${label} (optional)`,
    });

    const labelOf = (name: string) =>
      container.querySelector(`[data-next-address-field="${name}"] label`)
        ?.textContent;
    expect(labelOf('address2')).toBe('Apartment, suite, etc. (optional)');
    expect(labelOf('address1')).toBe('Address');
    expect(
      container.querySelector<HTMLInputElement>(
        '[data-next-checkout-field="address2"]'
      )?.placeholder
    ).toBe('Apartment, suite, etc. (optional)');
  });

  it('labels every control, and the label points at it', () => {
    render(container, JP, { form: 'shipping' });

    const label = container.querySelector<HTMLLabelElement>('label');
    expect(label?.textContent).toBe('Country');
    expect(container.querySelector(`#${label?.htmlFor}`)).not.toBeNull();
  });

  it('puts the label after its control, so CSS can reach it from the control', () => {
    render(container, US, { form: 'shipping' });

    const cell = container.querySelector('[data-next-address-field="city"]');
    expect([...(cell?.children ?? [])].map(el => el.tagName)).toEqual([
      'INPUT',
      'LABEL',
    ]);
  });
});

describe('renderLayout: rows that wait for the street address', () => {
  const US_WITH_LINE2: Spec = {
    ...US,
    layout: [['country'], ['line1'], ['line2'], ['city', 'state', 'postcode']],
    fields: {
      ...US.fields,
      line2: { ...text('Apartment', 'address-line2'), required: false },
    },
  };

  const locationRows = (component: string) =>
    Array.from(
      container.querySelectorAll(`[data-next-component="${component}"]`)
    ).map(row =>
      Array.from(row.querySelectorAll('[data-next-checkout-field]')).map(
        field => field.getAttribute('data-next-checkout-field')
      )
    );

  it('marks the city/state/postcode rows after line1, and nothing else', () => {
    render(container, US_WITH_LINE2, { form: 'shipping' });

    expect(locationRows('location')).toEqual([['city', 'province', 'postal']]);
  });

  it('marks each location row when a country splits them (TH)', () => {
    render(container, TH, { form: 'shipping' });

    expect(locationRows('location')).toEqual([['city'], ['postal']]);
  });

  it('marks nothing that comes before line1 (JP writes the postcode first)', () => {
    render(container, JP, { form: 'shipping' });

    expect(locationRows('location')).toEqual([]);
  });

  it('marks a billing block’s rows as billing-location', () => {
    render(container, US, { form: 'billing' });

    expect(locationRows('billing-location')).toEqual([
      ['billing-city', 'billing-province', 'billing-postal'],
    ]);
    expect(locationRows('location')).toEqual([]);
  });
});

describe('readRenderedValues', () => {
  it('reads what is in the text inputs', () => {
    render(container, US, { form: 'shipping' });
    container.querySelector<HTMLInputElement>(
      '[data-next-checkout-field="city"]'
    )!.value = 'Testville';

    expect(readRenderedValues(container)).toEqual({ city: 'Testville' });
  });

  it('does not carry a dropdown choice into another country', () => {
    render(container, US, { form: 'shipping' });
    const province = container.querySelector<HTMLSelectElement>(
      '[data-next-checkout-field="province"]'
    )!;
    const option = document.createElement('option');
    option.value = 'NY';
    option.textContent = 'New York';
    province.append(option);
    province.value = 'NY';

    expect(readRenderedValues(container)).not.toHaveProperty('province');
  });
});
