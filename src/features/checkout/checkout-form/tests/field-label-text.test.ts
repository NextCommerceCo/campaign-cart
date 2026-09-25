import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { CountryRules, RulesField } from '@/core/country-service';
import type { Logger } from '@/core/logger';

import { writeFieldLabels } from '../field-label-text';

const field = (label: string, required = true): RulesField => ({
  label,
  required,
  autocomplete: 'off',
  input: { type: 'text' },
});

const THAI: CountryRules = {
  country: 'TH',
  lang: 'th',
  address: { layout: [] },
  contact: { layout: [] },
  fields: {
    first_name: field('ชื่อ'),
    email: field('อีเมล'),
    phone: field('หมายเลขโทรศัพท์', false),
    postcode: field('รหัสไปรษณีย์'),
  },
};

const optional = (label: string) => `${label} (ไม่บังคับ)`;
const logger = { debug: vi.fn() } as unknown as Logger;
const $ = <T extends Element>(selector: string) =>
  document.querySelector(selector) as T;

beforeEach(() => {
  document.body.innerHTML = `
    <form>
      <label for="fname">First name</label>
      <input id="fname" data-next-checkout-field="fname" data-next-label>
      <label>Email <span data-next-label-text>Email</span> <b>*</b>
        <input data-next-checkout-field="email" data-next-label></label>
      <label for="phone"><i class="icon"></i>Phone</label>
      <input id="phone" data-next-checkout-field="phone" data-next-label>
      <label for="city">City</label>
      <input id="city" data-next-checkout-field="city" data-next-label>
      <input data-next-checkout-field="lname" placeholder="Last name">
      <input data-next-checkout-field="billing-postal" data-next-label placeholder="Postal">
    </form>`;
  writeFieldLabels(document.body, THAI, 'shipping', optional, logger);
});

describe('writeFieldLabels', () => {
  it("writes the rules' label into a text-only label and the placeholder", () => {
    expect($('label[for="fname"]').textContent).toBe('ชื่อ');
    expect($<HTMLInputElement>('#fname').placeholder).toBe('ชื่อ');
  });

  it('writes into [data-next-label-text] and leaves the rest of the label', () => {
    const label = $('label:has([data-next-checkout-field="email"])');
    expect(label.querySelector('[data-next-label-text]')?.textContent).toBe(
      'อีเมล'
    );
    expect(label.querySelector('b')?.textContent).toBe('*');
  });

  it('leaves a label holding markup it has no slot in', () => {
    expect($('label[for="phone"]').innerHTML).toBe('<i class="icon"></i>Phone');
    expect($<HTMLInputElement>('#phone').placeholder).toBe(
      'หมายเลขโทรศัพท์ (ไม่บังคับ)'
    );
  });

  it('writes the note only on a field neither the rules nor the page require', () => {
    document.querySelector('#phone')?.setAttribute('required', '');
    writeFieldLabels(document.body, THAI, 'shipping', optional, logger);
    expect($<HTMLInputElement>('#phone').placeholder).toBe('หมายเลขโทรศัพท์');
  });

  it('leaves a field the country does not ask for, and one that did not opt in', () => {
    expect($('label[for="city"]').textContent).toBe('City');
    expect(
      $<HTMLInputElement>('[data-next-checkout-field="lname"]').placeholder
    ).toBe('Last name');
  });

  it('writes a billing field only with the billing rules', () => {
    const billing = $<HTMLInputElement>(
      '[data-next-checkout-field="billing-postal"]'
    );
    expect(billing.placeholder).toBe('Postal');
    writeFieldLabels(document.body, THAI, 'billing', optional, logger);
    expect(billing.placeholder).toBe('รหัสไปรษณีย์');
  });
});
