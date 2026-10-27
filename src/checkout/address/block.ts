import type { Engine } from '../../engine/engine';
import type { CountryRules, FieldRule } from '../../engine/types';
import { type Control, type Fields, scanFields } from '../form/fields';
import { pageFieldName } from '../../compat/checkout';

interface Block {
  el: HTMLElement;
  prefix: '' | 'billing_';
  shown?: string;
}

const LOCATION = ['city', 'state', 'postcode'];

const text = (label: string, autocomplete: string, required = false, input: FieldRule['input'] = {}): FieldRule => ({
  label,
  required,
  autocomplete,
  input: { type: 'text', auto_capitalize: 'words', max_length: 255, ...input },
});

const BUILT_IN = {
  layout: [
    ['country'],
    ['first_name', 'last_name'],
    ['line1'],
    ['line2'],
    ['city', 'state', 'postcode'],
    ['phone_number'],
  ],
  fields: {
    country: { label: 'Country', required: true, autocomplete: 'country', input: { type: 'select' } },
    first_name: text('First name', 'given-name', true),
    last_name: text('Last name', 'family-name', true),
    line1: text('Address', 'address-line1', true),
    line2: text('Apartment, suite, etc.', 'address-line2'),
    city: text('City', 'address-level2', true, { span: 2 }),
    state: text('State/Province', 'address-level1'),
    postcode: text('Postal code', 'postal-code', false, { auto_capitalize: 'characters', max_length: 64 }),
    phone_number: text('Phone number', 'tel', false, { type: 'tel', input_mode: 'tel', max_length: 24 }),
  } as Record<string, FieldRule>,
};

function ruleFor(name: string, rules: CountryRules | undefined): FieldRule {
  const base = BUILT_IN.fields[name]!;
  const own = rules?.fields[name];
  return { ...base, ...own, input: { ...base.input, ...own?.input } };
}

function control(rule: FieldRule, page: string, id: string, section: string, label: string): Control {
  const el = document.createElement(rule.input?.type === 'select' ? 'select' : 'input');
  Object.assign(el, { id, name: page, className: 'next-address-control', required: rule.required });
  el.setAttribute('data-next-checkout-field', page);
  el.setAttribute('autocomplete', `${section} ${rule.autocomplete}`);
  if (el instanceof HTMLInputElement) {
    const { type = 'text', placeholder, max_length, input_mode, auto_capitalize } = rule.input ?? {};
    Object.assign(el, { type, placeholder: placeholder || label });
    if (max_length) el.maxLength = max_length;
    if (input_mode) el.inputMode = input_mode;
    if (auto_capitalize) el.autocapitalize = auto_capitalize;
  }
  return el;
}

function cell(block: Block, name: string, rules: CountryRules | undefined): HTMLElement {
  const rule = ruleFor(name, rules);
  const page = (block.prefix ? 'billing-' : '') + pageFieldName(name);
  const section = block.prefix ? 'billing' : 'shipping';
  const id = `next-${section}-${page}`;
  const label = (rule.required ? rule.label : (rule.label_optional ?? `${rule.label} (optional)`)) ?? name;
  const el = Object.assign(document.createElement('div'), { className: 'form-group next-address-field' });
  el.setAttribute('data-next-address-field', page);
  if (rule.input?.span) el.style.flexGrow = String(rule.input.span);
  const caption = Object.assign(document.createElement('label'), {
    htmlFor: id,
    className: 'next-address-label',
    textContent: label,
  });
  el.append(control(rule, page, id, section, label), caption);
  return el;
}

function layout(block: Block, rules: CountryRules | undefined, elsewhere: Set<string>): void {
  const lines = rules?.address?.layout ?? BUILT_IN.layout;
  const line1Row = lines.findIndex((row) => row.includes('line1'));
  const built = new Set<string>();
  const rows = lines.flatMap((row, i) => {
    const names = row.filter((name) => {
      const keep = name in BUILT_IN.fields && !elsewhere.has(block.prefix + name) && !built.has(name);
      if (keep) built.add(name);
      return keep;
    });
    if (!names.length) return [];
    const el = Object.assign(document.createElement('div'), { className: 'next-address-row' });
    el.setAttribute('data-next-address-row', String(i));
    if (line1Row >= 0 && i > line1Row && names.every((name) => LOCATION.includes(name)))
      el.setAttribute('data-next-component', block.prefix ? 'billing-location' : 'location');
    el.append(...names.map((name) => cell(block, name, rules)));
    return [el];
  });
  block.el.replaceChildren(...rows);
}

export function bindAddressForms(
  engine: Engine,
  form: HTMLFormElement,
  fields: Fields,
  rebuilt: () => void,
): () => void {
  const blocks: Block[] = [...form.querySelectorAll<HTMLElement>('[data-next-address]')].map((el) => ({
    el,
    prefix: el.getAttribute('data-next-address') === 'billing' ? 'billing_' : '',
  }));
  const elsewhere = new Set(fields.keys());

  return () => {
    const checkout = engine.getState().checkout;
    if (!checkout) return;
    let changed = false;
    for (const block of blocks) {
      const { fields: values, sameAsShipping, rules, rulesDown } = checkout;
      const country = (block.prefix && !sameAsShipping && values.billing_country) || values.country || '';
      const own = rules[country];
      const shown = own ? country : rulesDown ? 'built-in' : undefined;
      if (!shown) {
        if (!block.shown) block.el.setAttribute('data-next-address-state', 'loading');
        continue;
      }
      if (shown === block.shown) continue;
      layout(block, own, elsewhere);
      block.shown = shown;
      block.el.setAttribute('data-next-address-state', 'ready');
      changed = true;
    }
    if (!changed) return;
    scanFields(form, fields);
    rebuilt();
  };
}
