import type { Engine } from '../engine/engine';
import { option } from './messages';
import type { CountryOption } from '../engine/types';
import type { Fields } from './form';
import { legacyHiddenStates } from './legacy';

const WRAPPER =
  '.form-group, .frm-flds, .form-input, .select-form-wrapper, .field-wrapper, .input-wrapper, .form-field';

function fill(select: HTMLSelectElement, options: CountryOption[], value: string | undefined, placeholder?: string) {
  const first = select.options[0]?.value === '' ? select.options[0] : undefined;
  const key = options.map((o) => o.code).join(',');
  if (select.dataset.nextOptions !== key) {
    select.dataset.nextOptions = key;
    const blank = first ?? option('', '');
    select.replaceChildren(blank, ...options.map((o) => option(o.name, o.code)));
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

export function bindAddress(engine: Engine, form: HTMLFormElement, fields: Fields): () => void {
  const hidden = legacyHiddenStates();
  const boxes = {
    '': [
      ...form.querySelectorAll<HTMLElement>(
        '[data-next-component="location"], [data-next-component-location="location"]',
      ),
    ],
    billing_: [...form.querySelectorAll<HTMLElement>('[data-next-component="billing-location"]')],
  };
  const revealed = { '': false, billing_: false };

  return () => {
    const checkout = engine.getState().checkout;
    if (!checkout) return;
    for (const prefix of ['', 'billing_'] as const) {
      const country = fields.get(`${prefix}country`);
      const code = checkout.fields[`${prefix}country`];
      if (country instanceof HTMLSelectElement) fill(country, checkout.countries, code);

      const rules = checkout.rules[code ?? ''];
      const state = fields.get(`${prefix}state`);
      if (state instanceof HTMLSelectElement && rules) {
        const states = (rules.states ?? []).filter((s) => code !== 'US' || !hidden.includes(s.code));
        const label = rules.fields.state?.label;
        fill(state, states, checkout.fields[`${prefix}state`] ?? '', label && `Select ${label}`);
        const wrapper = state.closest<HTMLElement>(WRAPPER) ?? state;
        wrapper.style.display = states.length || rules.fields.state?.required ? '' : 'none';
      }

      revealed[prefix] ||= !!checkout.fields[`${prefix}line1`]?.trim();
      reveal(boxes[prefix], revealed[prefix]);
    }
  };
}
