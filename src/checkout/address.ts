import type { Engine } from '../engine/engine';
import { option } from './messages';
import type { CountryOption } from '../engine/types';
import type { Fields } from './form';
import { legacyHiddenStates } from './legacy';

const WRAPPER =
  '.form-group, .frm-flds, .form-input, .select-form-wrapper, .field-wrapper, .input-wrapper, .form-field';

function fill(
  select: HTMLSelectElement,
  options: CountryOption[],
  value: string | undefined,
  { placeholder, blank = true }: { placeholder?: string; blank?: boolean } = {},
) {
  const first = select.options[0]?.value === '' ? select.options[0] : undefined;
  const key = options.map((o) => o.code).join(',');
  if (select.dataset.nextOptions !== key) {
    select.dataset.nextOptions = key;
    const blanks = first ? [first] : blank ? [option('', '')] : [];
    select.replaceChildren(...blanks, ...options.map((o) => option(o.name, o.code)));
  }
  if (placeholder && select.options[0]) select.options[0].text = placeholder;
  if (value !== undefined && select.value !== value) select.value = value;
}

function reveal(boxes: HTMLElement[], shown: boolean): void {
  for (const box of boxes) {
    box.style.display = shown ? 'flex' : 'none';
    box.classList.toggle('next-location-hidden', !shown);
  }
}

const US_TERRITORIES = /^(AS|GU|MP|PR|VI|UM(-\d+)?)$/;

const BOXES = {
  '': '[data-next-component="location"], [data-next-component-location="location"]',
  billing_: '[data-next-component="billing-location"]',
};

export function bindAddress(engine: Engine, form: HTMLFormElement, fields: Fields): () => void {
  const hidden = legacyHiddenStates();
  const revealed = { '': false, billing_: false };

  return () => {
    const checkout = engine.getState().checkout;
    if (!checkout) return;
    for (const prefix of ['', 'billing_'] as const) {
      const country = fields.get(`${prefix}country`);
      const code = checkout.fields[`${prefix}country`] || (prefix ? checkout.fields.country : undefined);
      if (country instanceof HTMLSelectElement)
        fill(country, checkout.countries, code, { blank: !country.closest('[data-next-address]') });

      const rules = checkout.rules[code ?? ''];
      const state = fields.get(`${prefix}state`);
      if (state instanceof HTMLSelectElement && rules) {
        const states = (rules.states ?? []).filter(
          (s) => code !== 'US' || !(US_TERRITORIES.test(s.code) || hidden.includes(s.code)),
        );
        const label = rules.fields.state?.label;
        fill(state, states, checkout.fields[`${prefix}state`] ?? '', { placeholder: label && `Select ${label}` });
        const wrapper = state.closest<HTMLElement>(WRAPPER) ?? state;
        wrapper.style.display = states.length || rules.fields.state?.required ? '' : 'none';
      }

      revealed[prefix] ||= !!checkout.fields[`${prefix}line1`]?.trim();
      reveal([...form.querySelectorAll<HTMLElement>(BOXES[prefix])], revealed[prefix]);
    }
  };
}
