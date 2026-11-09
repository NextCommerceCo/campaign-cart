import { parseItems } from '../engine/actions';
import { optionPrice, publicToggle, unitsOf } from '../engine/cart/public';
import { cardSlots } from '../engine/cart/selectors';
import { toggleGroup } from '../engine/cart/toggles';
import type { SelectorCard, SelectorMode } from '../engine/cart/types';
import { cents } from '../engine/display/format';
import type { Engine } from '../engine/engine';
import type { Render } from '../dom/context';
import {
  bindToggle,
  cardFromElement,
  inputValues,
  matching,
  onceVisible,
  registerSelector,
  stateClasses,
} from '../dom/dom';
import type { AttributeContext } from './context';

type Model = Record<string, unknown>;

const list = (raw: string | null) =>
  (raw ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

/** `data-next-selected`, as a page sets it: present and not `"false"`. */
const preselected = (el: Element) =>
  el.hasAttribute('data-next-selected') && el.getAttribute('data-next-selected') !== 'false';

/** The campaign's prices for lines nobody priced yet, so a card shows a price before its quote arrives. */
export function withCatalogPrice<T extends Model>(engine: Engine, object: T | undefined): T | undefined {
  if (!object || object.total !== undefined || object.type === 'offer') return object;
  const lines = (object.lines as Array<{ package_id: number; quantity: number }> | undefined) ?? [];
  const packages = lines.map((l) => engine.getPackage(l.package_id));
  if (!lines.length || packages.some((p) => !p)) return object;
  const total = lines.reduce((n, l, i) => n + cents(packages[i]!.price_total) * l.quantity, 0) / 100;
  return { ...object, total, ...optionPrice(total, total, unitsOf(lines)) };
}

const PRICE_FIELDS = ['total', 'price', 'original_price', 'subtotal', 'total_discount', 'discount_percentage'];

/** Keeps each model's last server price on screen while its next one is on the way. */
function priceHolder(engine: Engine, selectorId: string) {
  const last = new Map<string, Model>();
  return (key: string, model: Model | undefined, offer: boolean): Model | undefined => {
    if (!model) return model;
    if (model.total !== undefined) {
      last.set(key, model);
      return model;
    }
    const held = engine.selectors.get(selectorId)?.quoting && last.get(key);
    if (held) return { ...model, ...Object.fromEntries(PRICE_FIELDS.map((f) => [f, held[f]])) };
    return offer ? model : withCatalogPrice(engine, model);
  };
}

/** Option state as attributes, and the 0.4.x classes page CSS already selects. */
function showState(el: Element, selected: boolean, inCart: boolean, loading: boolean): void {
  el.toggleAttribute('data-next-selected', selected);
  el.setAttribute('aria-pressed', String(selected));
  el.toggleAttribute('data-next-in-cart', inCart);
  el.toggleAttribute('data-next-loading', loading);
  stateClasses(el, selected, inCart);
}

function cardOf(el: Element, id: string): SelectorCard | undefined {
  const lines = parseItems(el.getAttribute('data-next-items') ?? undefined);
  if (!lines.length) return undefined;
  const slots = el.hasAttribute('data-next-slots');
  return cardFromElement(
    el,
    id,
    slots ? lines.map((l) => ({ ...l, configurable: true })) : lines,
    list(el.getAttribute('data-next-vouchers')),
  );
}

export const PROPERTY_FIELD = '[data-next-field^="properties."]';

/** Line properties typed into `data-next-field="properties.<name>"` inputs. */
export const propertiesOf = (inputs: Iterable<Element>): Record<string, string> =>
  inputValues(inputs, (i) => i.getAttribute('data-next-field')!.slice('properties.'.length));

const orderPage = () => {
  const params = new URLSearchParams(location.search);
  return params.has('ref_id') || params.has('order_ref_id');
};

/** A picked option's slots, one per unit, each a line of its own package. */
function slotsOf(a: AttributeContext, selectorId: string, optionId: string): Model[] {
  const selector = a.engine.selectors.get(selectorId);
  const card = selector?.cards.find((c) => c.id === optionId);
  if (!selector || !card) return [];
  return cardSlots(selector, card).map((slot, index) => ({
    ...(a.query.get(`package.${slot.packageId}`) as Model),
    ...(slot.properties && { properties: slot.properties }),
    slot_index: index,
    selector_id: selectorId,
    option_id: optionId,
  }));
}

function bindSelector(selectorEl: HTMLElement, a: AttributeContext): Render[] {
  const id = selectorEl.getAttribute('data-next-selector') || 'default';
  const priced = priceHolder(a.engine, id);
  const els = new Map<string, HTMLElement>();
  const cards: SelectorCard[] = [];
  selectorEl.querySelectorAll<HTMLElement>('[data-next-option]').forEach((el, i) => {
    if (el.closest('[data-next-selector]') !== selectorEl || !a.b.claim(el, 'data-next-option')) return;
    const optionId = el.getAttribute('data-next-option') || String(i);
    const card = cardOf(el, optionId);
    if (!card) return a.b.warn(`option "${optionId}" in selector "${id}" has no data-next-items`);
    cards.push(card);
    els.set(optionId, el);
    a.setScope(el, () => {
      const option = a.query.get(`selector.${id}.options.${optionId}`) as Model | undefined;
      const selector = a.query.get(`selector.${id}`) as Model | undefined;
      const shown = priced(optionId, option, selector?.type === 'offer');
      return shown && { ...shown, selector_id: id, slots: slotsOf(a, id, optionId) };
    });
  });
  if (!cards.length) return [];
  const mode: SelectorMode = orderPage() ? 'offer' : selectorEl.hasAttribute('data-next-defer') ? 'select' : 'swap';
  els.forEach((el, optionId) => {
    const own = [...el.querySelectorAll(PROPERTY_FIELD)].filter((i) => !i.closest('[data-next-each]'));
    for (const input of own)
      input.addEventListener('change', () => {
        const selector = a.engine.selectors.get(id);
        if (!selector) return;
        const properties = propertiesOf(own);
        const withProperties = selector.cards.map((c) =>
          c.id === optionId
            ? {
                ...c,
                lines: c.lines.map(({ properties: _, ...l }) =>
                  Object.keys(properties).length ? { ...l, properties } : l,
                ),
              }
            : c,
        );
        void a.engine.selectors.register(id, withProperties, selector.mode);
      });
  });
  a.setScope(selectorEl, () => {
    const selector = a.query.get(`selector.${id}`) as Model | undefined;
    return priced('', selector, selector?.type === 'offer');
  });
  registerSelector(a.b, selectorEl, id, cards, els, mode, preselected);
  return [
    ...(mode === 'offer' ? [announceOffer(selectorEl, id, a)] : []),
    () => {
      const selector = a.query.get(`selector.${id}`) as { in_cart?: boolean; option_id?: string } | undefined;
      const quoting = !!a.engine.selectors.get(id)?.quoting;
      els.forEach((el, optionId) => {
        const selected = selector?.option_id === optionId;
        showState(el, selected, selected && !!selector?.in_cart, quoting);
      });
    },
  ];
}

function bindBump(el: HTMLElement, a: AttributeContext): Render[] {
  const optionId = el.getAttribute('data-next-option') || '';
  const lines = parseItems(el.getAttribute('data-next-items') ?? undefined);
  const [line] = lines;
  if (!line || lines.length > 1) {
    a.b.warn(`order bump "${optionId}" needs data-next-items with one package`);
    return [];
  }
  const { engine } = a;
  const group = toggleGroup(line.packageId);
  const on = () => !!engine.getState().cart.groups[group];
  const current = () =>
    publicToggle(engine.getState(), group, engine.getState().cart.groups[group] ?? { lines: [line], vouchers: [] });
  if (optionId) a.query.register(`selector.${optionId}`, current);
  a.setScope(el, () => {
    const toggle = withCatalogPrice(engine, current() as unknown as Model)!;
    return { ...toggle, option_id: optionId, selected: toggle.in_cart };
  });
  const add = () => {
    const properties = propertiesOf(el.querySelectorAll(PROPERTY_FIELD));
    return engine.cart.setGroup(group, {
      lines: [{ ...line, ...(Object.keys(properties).length && { properties }) }],
      vouchers: [],
    });
  };
  bindToggle(
    a.b,
    el,
    line.packageId,
    () => line.quantity,
    add,
    [...el.querySelectorAll(PROPERTY_FIELD)],
    on,
    preselected(el),
  );
  return [
    () => {
      engine.toggles.price(line.packageId, line.quantity);
      const inCart = on();
      showState(el, inCart, inCart, false);
    },
  ];
}

/** `upsell.shown` once the order is in and the offer priced, `upsell.viewed` once it is also half on screen; once each. */
function announceOffer(el: Element, selectorId: string, a: AttributeContext): Render {
  let shown = false;
  let onScreen = false;
  let viewed = false;
  a.b.offs.push(onceVisible(el, () => (onScreen = true)));
  return () => {
    const actions = a.engine.order;
    if (!actions || !a.engine.getState().order?.order || a.engine.selectors.get(selectorId)?.quoting) return;
    const spec = { selectorId };
    if (!shown) {
      shown = true;
      actions.shown(spec, location.pathname);
    }
    if (onScreen && !viewed) {
      viewed = true;
      actions.view(spec, location.pathname);
    }
  };
}

function bindOffer(el: HTMLElement, a: AttributeContext): Render[] {
  const id = el.getAttribute('data-next-option') || 'offer';
  const card = cardOf(el, id);
  if (!card) {
    a.b.warn(`offer "${id}" has no data-next-items`);
    return [];
  }
  void a.engine.selectors.register(id, [card], 'offer', id);
  a.setScope(el, () => a.query.get(`selector.${id}`));
  return [announceOffer(el, id, a)];
}

/** `data-next-selector` with its `data-next-option`s, and an option on its own: an order bump, or an offer after the order. */
export function bindOptions(root: ParentNode, a: AttributeContext): Render[] {
  const renders: Render[] = [];
  a.b.each(root, 'data-next-selector', (el) => renders.push(...bindSelector(el, a)));
  for (const el of matching(root, '[data-next-option]')) {
    if (el.closest('[data-next-selector]') || !a.b.claim(el, 'data-next-option')) continue;
    renders.push(...(orderPage() ? bindOffer(el, a) : bindBump(el, a)));
  }
  return renders;
}
