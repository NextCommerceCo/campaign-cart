import { beforeEach, describe, expect, it } from 'vitest';

import type { AddressSpec } from '../address-form.api';
import {
  readRenderedValues,
  renderAddressSpec,
  sdkFieldName,
} from '../address-form.renderer';

const text = (
  name: string,
  label: string,
  autocomplete: string,
  extra: Record<string, unknown> = {}
) => ({ name, label, required: true, autocomplete, control: 'text' as const, ...extra });

const US: AddressSpec = {
  country: 'US',
  layout: [['country'], ['line1'], ['city', 'state', 'postcode']],
  fields: {
    country: {
      ...text('country', 'Country', 'country'),
      control: 'select',
    },
    line1: text('line1', 'Address', 'address-line1'),
    city: text('city', 'City', 'address-level2'),
    state: {
      ...text('state', 'State', 'address-level1'),
      control: 'select',
      optionsSource: 'states',
    },
    postcode: text('postcode', 'ZIP Code', 'postal-code', { maxLength: 10 }),
  },
};

const JP: AddressSpec = {
  country: 'JP',
  layout: [['country'], ['postcode', 'state'], ['city'], ['line1']],
  fields: {
    country: { ...text('country', 'Country', 'country'), control: 'select' },
    postcode: text('postcode', '郵便番号', 'postal-code'),
    state: { ...text('state', '都道府県', 'address-level1'), control: 'select' },
    city: text('city', '市区町村', 'address-level2'),
    line1: text('line1', '番地', 'address-line1'),
  },
};

const TH: AddressSpec = {
  country: 'TH',
  layout: [['country'], ['line1'], ['line3'], ['city'], ['postcode']],
  fields: {
    country: { ...text('country', 'Country', 'country'), control: 'select' },
    line1: text('line1', 'Address', 'address-line1'),
    line3: text('line3', 'Sub-district', 'address-level3'),
    city: text('city', 'District', 'address-level2'),
    postcode: text('postcode', 'Postcode', 'postal-code'),
  },
};

/** The same layout with the name row a page may collect in a step of its own. */
const US_WITH_NAME: AddressSpec = {
  ...US,
  layout: [['country'], ['first_name', 'last_name'], ['line1'], ['city', 'state', 'postcode']],
  fields: {
    ...US.fields,
    first_name: text('first_name', 'First name', 'given-name'),
    last_name: text('last_name', 'Last name', 'family-name'),
  },
};

let container: HTMLElement;

beforeEach(() => {
  container = document.createElement('div');
  document.body.append(container);
});

describe('sdkFieldName', () => {
  it.each([
    ['line1', 'address1'],
    ['line2', 'address2'],
    ['state', 'province'],
    ['postcode', 'postal'],
    ['phone_number', 'phone'],
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

describe('renderAddressSpec', () => {
  it('builds the fields the layout names, in layout order', () => {
    const rendered = renderAddressSpec(container, US, { form: 'shipping' });

    expect(rendered).toEqual(['country', 'address1', 'city', 'province', 'postal']);
  });

  it('puts a country’s fields where that country writes them', () => {
    const rendered = renderAddressSpec(container, JP, { form: 'shipping' });

    expect(rendered).toEqual(['country', 'postal', 'province', 'city', 'address1']);
    const secondRow = container.querySelector('[data-next-address-row="1"]');
    expect(
      [...(secondRow?.querySelectorAll('[data-next-address-field]') ?? [])].map(cell =>
        cell.getAttribute('data-next-address-field')
      )
    ).toEqual(['postal', 'province']);
  });

  it('marks every control as a checkout field', () => {
    renderAddressSpec(container, US, { form: 'shipping' });

    const fields = [...container.querySelectorAll('[data-next-checkout-field]')].map(el =>
      el.getAttribute('data-next-checkout-field')
    );
    expect(fields).toEqual(['country', 'address1', 'city', 'province', 'postal']);
  });

    it('prefixes autocomplete with the form it belongs to', () => {
    renderAddressSpec(container, US, { form: 'shipping' });

    expect(
      container
        .querySelector('[data-next-checkout-field="address1"]')
        ?.getAttribute('autocomplete')
    ).toBe('shipping address-line1');
  });

  it('builds a select for a field whose options another part of the SDK fills', () => {
    renderAddressSpec(container, US, { form: 'shipping' });

    const province = container.querySelector('[data-next-checkout-field="province"]');
    expect(province?.tagName).toBe('SELECT');
    expect(province?.children).toHaveLength(0);
  });

  it('leaves out a field this SDK does not collect, and the rest of its row stands', () => {
    const rendered = renderAddressSpec(container, TH, { form: 'shipping' });

    expect(rendered).not.toContain('line3');
    expect(rendered).toEqual(['country', 'address1', 'city', 'postal']);
  });

  it('does not build a field the page already collects elsewhere', () => {
    const rendered = renderAddressSpec(container, US_WITH_NAME, {
      form: 'shipping',
      alreadyCollected: new Set(['fname', 'lname']),
    });

    expect(rendered).toEqual(['country', 'address1', 'city', 'province', 'postal']);
    expect(container.querySelector('[data-next-checkout-field="fname"]')).toBeNull();
  });

  it('drops the row entirely when every field on it is collected elsewhere', () => {
    renderAddressSpec(container, US_WITH_NAME, {
      form: 'shipping',
      alreadyCollected: new Set(['fname', 'lname']),
    });

    const rows = [...container.querySelectorAll('[data-next-address-row]')].map(r =>
      r.getAttribute('data-next-address-row')
    );
    expect(rows).not.toContain('1');
  });

  it('builds a field once even when the layout names it twice', () => {
    const twice: AddressSpec = {
      ...US,
      layout: [['country'], ['line1'], ['line1'], ['city']],
    };

    const rendered = renderAddressSpec(container, twice, { form: 'shipping' });

    expect(rendered).toEqual(['country', 'address1', 'city']);
    expect(
      container.querySelectorAll('[data-next-checkout-field="address1"]')
    ).toHaveLength(1);
  });

  it('replaces the previous country’s fields rather than adding to them', () => {
    renderAddressSpec(container, US, { form: 'shipping' });
    renderAddressSpec(container, JP, { form: 'shipping' });

    expect(container.querySelectorAll('[data-next-checkout-field]')).toHaveLength(5);
    expect(container.querySelector('[data-next-address-row="2"]')?.textContent).toContain(
      '市区町村'
    );
  });

  it('puts back what the shopper had typed', () => {
    renderAddressSpec(container, US, {
      form: 'shipping',
      values: { address1: '1 Test Street', city: 'Testville' },
    });

    expect(
      container.querySelector<HTMLInputElement>('[data-next-checkout-field="address1"]')
        ?.value
    ).toBe('1 Test Street');
  });

  it('wraps every field in .form-group, which the SDK queries for', () => {
    renderAddressSpec(container, US, { form: 'shipping' });

    expect(container.querySelectorAll('.form-group')).toHaveLength(5);
    expect(
      container
        .querySelector('[data-next-address-field="province"]')
        ?.classList.contains('form-group')
    ).toBe(true);
  });

  it('builds billing-prefixed fields for a billing block', () => {
    const rendered = renderAddressSpec(container, US, { form: 'billing' });

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
    renderAddressSpec(container, US, { form: 'shipping' });

    expect(
      container.querySelector<HTMLInputElement>('[data-next-checkout-field="city"]')
        ?.placeholder
    ).toBe('City');
  });

  it('labels every control, and the label points at it', () => {
    renderAddressSpec(container, JP, { form: 'shipping' });

    const label = container.querySelector<HTMLLabelElement>('label');
    expect(label?.textContent).toBe('Country');
    expect(container.querySelector(`#${label?.htmlFor}`)).not.toBeNull();
  });

  it('puts the label after its control, so CSS can reach it from the control', () => {
    renderAddressSpec(container, US, { form: 'shipping' });

    const cell = container.querySelector('[data-next-address-field="city"]');
    expect([...(cell?.children ?? [])].map(el => el.tagName)).toEqual([
      'INPUT',
      'LABEL',
    ]);
  });
});

describe('readRenderedValues', () => {
  it('reads what is in the text inputs', () => {
    renderAddressSpec(container, US, { form: 'shipping' });
    container.querySelector<HTMLInputElement>(
      '[data-next-checkout-field="city"]'
    )!.value = 'Testville';

    expect(readRenderedValues(container)).toEqual({ city: 'Testville' });
  });

  it('does not carry a dropdown choice into another country', () => {
    renderAddressSpec(container, US, { form: 'shipping' });
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
