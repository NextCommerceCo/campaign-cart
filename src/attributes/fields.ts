import { variantChoices } from '../engine/cart/variants';
import type { Engine } from '../engine/engine';
import type { Query } from '../engine/query';
import type { Render } from '../bindings/context';
import type { AttributeContext } from './context';

type Model = Record<string, unknown>;

/** One value of a variant attribute, as a picker row reads it. */
export interface VariantValue {
  value: string;
  name: string;
  available: boolean;
  selected: boolean;
  package_id?: number;
  price?: number;
}

/** The package an object stands for: a line's, or a one-line option's. */
const packageOf = (o: Model): number | undefined => {
  if (typeof o.package_id === 'number') return o.package_id;
  const lines = o.lines as Array<{ package_id: number }> | undefined;
  return lines?.length === 1 ? lines[0]!.package_id : undefined;
};

/** Each variant attribute of the object's package (`variants.size`), with the values a shopper can pick. */
export function variantsOf(engine: Engine, o: Model): Record<string, VariantValue[]> | undefined {
  const packageId = packageOf(o);
  const packages = engine.getState().campaign?.packages ?? [];
  if (!packageId) return undefined;
  const choices = variantChoices(packages, packageId);
  if (!choices.length) return undefined;
  return Object.fromEntries(
    choices.map((c) => [
      c.code,
      c.options.map((option) => {
        const pkg = packages.find((p) => p.ref_id === option.packageId);
        return {
          value: option.value,
          name: option.value,
          available: !!option.packageId,
          selected: option.value === c.value,
          ...(option.packageId && { package_id: option.packageId }),
          ...(pkg && { price: Number(pkg.price_total) }),
        };
      }),
    ]),
  );
}

/** Makes `variants` a field of every object that stands for one package, for `data-next-each` and pickers. */
export function defineVariants(query: Query, engine: Engine): void {
  for (const type of ['CartItem', 'Option', 'Selector'] as const)
    query.define(type, 'variants', (o: Model) => variantsOf(engine, o));
}

const slug = (value: string) => value.toLowerCase().replace(/[^a-z0-9]+/g, '-');

function pickArgs(scope: unknown, code: string, value: string) {
  const o = (scope ?? {}) as Model;
  const pick = (k: string) => (o[k] === undefined ? {} : { [k]: o[k] as string | number });
  return { ...pick('selector_id'), ...pick('option_id'), ...pick('slot_index'), ...pick('package_id'), code, value };
}

function bindPicker(el: HTMLElement, code: string, a: AttributeContext): Render {
  const values = () => ((a.read('variants', el) as Record<string, VariantValue[]> | undefined) ?? {})[code] ?? [];
  const apply = (value: string) => void a.actions.selectVariant(pickArgs(a.scopeOf(el), code, value));
  let drawn = '';
  if (el instanceof HTMLSelectElement) {
    el.addEventListener('change', () => apply(el.value));
    return () => {
      const list = values();
      const key = JSON.stringify(list);
      if (key === drawn) return;
      drawn = key;
      el.replaceChildren(
        ...list.map((v) => {
          const option = document.createElement('option');
          option.value = v.value;
          option.textContent = v.name;
          option.selected = v.selected;
          option.disabled = !v.available;
          return option;
        }),
      );
    };
  }
  el.addEventListener('click', (e) => {
    const button = (e.target as Element).closest<HTMLButtonElement>('[data-next-value]');
    if (button && el.contains(button) && !button.disabled) apply(button.dataset.nextValueRaw ?? '');
  });
  return () => {
    const list = values();
    const key = JSON.stringify(list);
    if (key === drawn) return;
    drawn = key;
    el.setAttribute('data-next-variant', code);
    el.replaceChildren(
      ...list.map((v) => {
        const button = document.createElement('button');
        button.type = 'button';
        button.textContent = v.name;
        button.setAttribute('aria-label', v.name);
        button.setAttribute('data-next-value', slug(v.value));
        button.dataset.nextValueRaw = v.value;
        button.setAttribute('aria-pressed', String(v.selected));
        button.toggleAttribute('data-next-selected', v.selected);
        button.toggleAttribute('data-next-disabled', !v.available);
        button.disabled = !v.available;
        return button;
      }),
    );
  };
}

function bindProperty(input: HTMLInputElement, a: AttributeContext): void {
  input.addEventListener('change', () => {
    const scope = a.scopeOf(input) as Model | undefined;
    const row = input.closest('[data-next-each] > *');
    if (!row || !scope || scope.slot_index === undefined) return;
    const properties: Record<string, string> = {};
    for (const field of row.querySelectorAll<HTMLInputElement>('[data-next-field^="properties."]')) {
      const value = field.value.trim();
      if (value) properties[field.getAttribute('data-next-field')!.slice('properties.'.length)] = value;
    }
    void a.engine.selectors.setSlot(String(scope.selector_id), String(scope.option_id), Number(scope.slot_index), {
      properties,
    });
  });
}

/** `data-next-field` outside a checkout form: `variants.<code>` pickers and a slot's `properties.<name>`. */
export function bindFields(root: ParentNode, a: AttributeContext): Render[] {
  const els = [...root.querySelectorAll<HTMLElement>('[data-next-field]')];
  if (root instanceof HTMLElement && root.matches('[data-next-field]')) els.unshift(root);
  const renders: Render[] = [];
  for (const el of els) {
    if (el.closest('form[data-next-checkout]') || !a.b.claim(el, 'data-next-field')) continue;
    const name = el.getAttribute('data-next-field') ?? '';
    if (name.startsWith('variants.')) renders.push(bindPicker(el, name.slice('variants.'.length), a));
    else if (name.startsWith('properties.') && el instanceof HTMLInputElement && el.closest('[data-next-each]'))
      bindProperty(el, a);
  }
  return renders;
}
