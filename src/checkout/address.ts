import type { Engine } from '../engine/engine';
import { BY_COUNTRY, formatPostcode } from '../engine/rules';
import { option } from './messages';
import type { CountryOption, CountryRules, FieldRule } from '../engine/types';
import { type Control, fieldName, type Fields } from './form';
import { legacyHiddenStates } from '../compat/checkout';
import { reformat } from './reformat';

const WRAPPER =
  '.form-group, .frm-flds, .form-input, .select-form-wrapper, .field-wrapper, .input-wrapper, .form-field';
const BUILT = '[data-next-address]';
const SIGNIFICANT = /[\p{L}\p{N}]/u;
const INPUT_ATTRS = { max_length: 'maxlength', input_mode: 'inputmode', auto_capitalize: 'autocapitalize' } as const;

interface PageText {
  label?: string;
  placeholder?: string;
  attrs: Record<string, string | null>;
}

const pageText = new WeakMap<Control, PageText>();

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

function boxOf(el: Control): HTMLElement {
  const group = el.closest<HTMLElement>('.form-group');
  if (group && group.querySelectorAll('input, select, textarea').length === 1) return group;
  return el.closest<HTMLElement>(WRAPPER) ?? el;
}

function own(el: Control): PageText {
  let saved = pageText.get(el);
  if (!saved) {
    saved = {
      label: el.labels?.[0]?.textContent ?? undefined,
      placeholder: el.getAttribute('placeholder') ?? undefined,
      attrs: Object.fromEntries(Object.values(INPUT_ATTRS).map((a) => [a, el.getAttribute(a)])),
    };
    pageText.set(el, saved);
  }
  return saved;
}

const marked = (text: string, page: string | undefined, required: boolean) =>
  required ? text + (page?.match(/\s*\*\s*$/)?.[0] ?? '') : text;

function relabel(el: Control, rule: FieldRule): void {
  const page = own(el);
  const text = rule.required ? rule.label : (rule.label_optional ?? rule.label);
  if (!text) return;
  const label = el.labels?.[0];
  const labelText = marked(text, page.label, rule.required);
  if (label && page.label !== undefined && label.textContent !== labelText) label.textContent = labelText;
  const placeholder = marked(text, page.placeholder, rule.required);
  if (page.placeholder && el instanceof HTMLInputElement && el.placeholder !== placeholder)
    el.placeholder = placeholder;
}

function applyInput(el: HTMLInputElement, rule: FieldRule, byCountry: boolean): void {
  const page = own(el);
  const digitsOnly = /^[\d\s-]+$/.test(rule.format?.example ?? '');
  for (const [key, attr] of Object.entries(INPUT_ATTRS)) {
    const pageValue = page.attrs[attr];
    if (pageValue !== null && !byCountry) continue;
    const ruled = rule.input?.[key as keyof typeof INPUT_ATTRS];
    const value = ruled ?? (attr === 'inputmode' && pageValue === 'numeric' && !digitsOnly ? null : pageValue);
    if (value === null || value === undefined) el.removeAttribute(attr);
    else el.setAttribute(attr, String(value));
  }
}

function asText(select: HTMLSelectElement): HTMLInputElement {
  const input = document.createElement('input');
  for (const { name, value } of select.attributes) if (name !== 'data-next-options') input.setAttribute(name, value);
  input.type = 'text';
  pageText.set(input, own(select));
  return input;
}

const US_TERRITORIES = /^(AS|GU|MP|PR|VI|UM(-\d+)?)$/;

const BOXES = {
  '': '[data-next-component="location"], [data-next-component-location="location"]',
  billing_: '[data-next-component="billing-location"]',
};

export function bindAddress(engine: Engine, form: HTMLFormElement, fields: Fields): () => void {
  const hidden = legacyHiddenStates();
  const revealed = { '': false, billing_: false };
  const states = new Map<string, { select: HTMLSelectElement; input: HTMLInputElement }>();
  const rulesFor = (name: string): CountryRules | undefined => {
    const checkout = engine.getState().checkout;
    const country = name.startsWith('billing_') ? checkout?.fields.billing_country : checkout?.fields.country;
    return checkout?.rules[country ?? ''];
  };

  form.addEventListener(
    'input',
    (e) => {
      const el = e.target;
      const name = el instanceof HTMLInputElement ? fieldName(el) : undefined;
      if (!name || name.replace(/^billing_/, '') !== 'postcode' || fields.get(name) !== el) return;
      const format = rulesFor(name)?.fields.postcode?.format;
      reformat(el as HTMLInputElement, formatPostcode((el as HTMLInputElement).value, format), SIGNIFICANT);
    },
    true,
  );

  const stateControl = (name: string, text: boolean): Control | undefined => {
    const current = fields.get(name);
    let pair = states.get(name);
    if (!pair && current instanceof HTMLSelectElement && text) {
      states.set(name, (pair = { select: current, input: asText(current) }));
    }
    if (!pair) return current;
    const next = text ? pair.input : pair.select;
    if (current !== next) {
      current?.replaceWith(next);
      fields.set(name, next);
    }
    return next;
  };

  return () => {
    const checkout = engine.getState().checkout;
    if (!checkout) return;
    for (const prefix of ['', 'billing_'] as const) {
      const country = fields.get(`${prefix}country`);
      const code = checkout.fields[`${prefix}country`] || (prefix ? checkout.fields.country : undefined);
      if (country instanceof HTMLSelectElement)
        fill(country, checkout.countries, code, { blank: !country.closest(BUILT) });

      const rules = checkout.rules[code ?? ''];
      const stateRule = rules?.fields.state;
      const page = fields.get(`${prefix}state`);
      if (rules && page) {
        const state = page.closest(BUILT) ? page : stateControl(`${prefix}state`, stateRule?.input?.type === 'text');
        if (state instanceof HTMLSelectElement) {
          const options = (rules.states ?? []).filter(
            (s) => code !== 'US' || !(US_TERRITORIES.test(s.code) || hidden.includes(s.code)),
          );
          fill(state, options, checkout.fields[`${prefix}state`] ?? '', {
            placeholder: stateRule?.input?.placeholder ?? stateRule?.label,
          });
        }
      }

      for (const [name, el] of fields) {
        if (!name.startsWith(prefix) || (!prefix && name.startsWith('billing_')) || el.closest(BUILT)) continue;
        const base = name.slice(prefix.length);
        const rule = rules?.fields[base];
        if (rules && BY_COUNTRY.includes(base)) {
          const shown = !!rule && (base !== 'state' || !(el instanceof HTMLSelectElement) || el.options.length > 1);
          boxOf(el).style.display = shown || rule?.required ? '' : 'none';
        }
        if (!rule) continue;
        if (BY_COUNTRY.includes(base)) relabel(el, rule);
        if (el instanceof HTMLInputElement) applyInput(el, rule, BY_COUNTRY.includes(base));
      }

      revealed[prefix] ||= !!checkout.fields[`${prefix}line1`]?.trim();
      reveal([...form.querySelectorAll<HTMLElement>(BOXES[prefix])], revealed[prefix]);
    }
  };
}
