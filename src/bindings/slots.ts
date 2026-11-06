import type { Engine } from '../engine/engine';
import { cardSlots, pickedCard } from '../engine/cart/selectors';
import { variantChoices } from '../engine/cart/variants';
import type { SummaryDiscount, SelectorState, SelectorCard, Slot, SummaryLine } from '../engine/cart/types';
import type { Package } from '../engine/types';
import { cents, discountPercent, dollars, format, formatCents, localeOf } from '../engine/format';
import { cardQuote } from '../engine/values';
import { applyValues, bindTokens, ownProperties, pageProperties, selectorIdOf } from './dom';

const escape = (text: string) =>
  text.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

const fill = (html: string, values: Record<string, string>) =>
  html.replace(/\{((?:slot|item|discount)\.\w+)\}/g, (raw, key: string) =>
    key in values ? escape(values[key]!) : raw,
  );

type Values = Record<string, string>;

function priceValues(engine: Engine, pkg: Package | undefined, line?: SummaryLine): Values {
  const money = (c: number) => formatCents(c, engine.getState());
  const unit = line ? cents(line.package_price) : cents(pkg?.price);
  const retail = line ? cents(line.original_package_price) : cents(pkg?.price_retail ?? pkg?.price);
  const total = line ? unit : cents(pkg?.price_total);
  const retailTotal = line ? retail : cents(pkg?.price_retail_total ?? pkg?.price_total);
  const saved = Math.max(0, retailTotal - total);
  const off = line ? Math.max(0, cents(line.total_discount)) : saved;
  const base = line ? cents(line.subtotal) : retailTotal;
  return {
    'item.price': money(total),
    'item.originalPrice': money(retailTotal),
    'item.unitPrice': money(unit),
    'item.originalUnitPrice': money(retail),
    'item.discountAmount': money(saved),
    'item.discountPercentage': base ? `${Math.round((off / base) * 100)}%` : '0%',
    'item.hasDiscount': off > 0 ? 'show' : 'hide',
  };
}

function itemValues(engine: Engine, pkg: Package | undefined, index: number): Values {
  return {
    'slot.index': String(index),
    'slot.unitIndex': String(index),
    'slot.unitNumber': String(index + 1),
    'item.packageId': String(pkg?.ref_id ?? ''),
    'item.name': pkg?.name ?? '',
    'item.image': pkg?.image ?? '',
    'item.quantity': String(pkg?.qty ?? 1),
    'item.variantName': pkg?.product_variant_name ?? '',
    'item.productName': pkg?.product_name ?? '',
    'item.sku': pkg?.product_sku ?? '',
    'item.currency': engine.getState().campaign?.currency ?? '',
  };
}

function discounts(engine: Engine, packageId: number, kind: string, pending: boolean): SummaryDiscount[] | undefined {
  const summary = engine.getState().cart.summary;
  const pool = new Set(
    (kind === 'voucher' ? summary?.voucher_discounts : summary?.offer_discounts)?.map((d) => d.offer_id),
  );
  const line = summary?.lines.find((l) => l.package_id === packageId);
  if (!line && pending) return undefined;
  return (line?.discounts ?? []).filter((d) => pool.has(d.offer_id));
}

const drawnOptions = new WeakMap<Element, string>();

/**
 * Draws a unit's variant selects. A field whose options and availability are unchanged is kept and only
 * moves its pick; any other field is drawn anew, so page scripts that wrap a select draw theirs again.
 */
function variantSelects(
  engine: Engine,
  host: Element,
  slot: Slot,
  choose: (code: string, value: string) => void,
): void {
  const choices = variantChoices(engine.getState().campaign?.packages ?? [], slot.packageId);
  if (!choices.length) return;
  const drawn = [...host.querySelectorAll<HTMLElement>(':scope > [data-next-variant-code]')];
  if (!drawn.length) host.replaceChildren();
  for (const { code, name, value, options } of choices) {
    const key = JSON.stringify(options.map((o) => [o.value, !!o.packageId]));
    const kept = drawn.find((f) => f.dataset.nextVariantCode === code && drawnOptions.get(f) === key);
    const select = kept?.querySelector('select');
    if (kept && select) {
      for (const option of select.options)
        if (option.selected !== (option.value === value)) option.selected = option.value === value;
      continue;
    }
    const field = Object.assign(document.createElement('div'), { className: 'next-slot-variant-field' });
    Object.assign(field.dataset, { nextVariantCode: code, nextVariantName: name });
    drawnOptions.set(field, key);
    const label = Object.assign(document.createElement('label'), {
      className: 'next-slot-variant-label',
      textContent: `Select ${name}:`,
    });
    const created = Object.assign(document.createElement('select'), { className: 'next-slot-variant-select' });
    created.dataset.nextVariantCode = code;
    for (const option of options) {
      const el = Object.assign(document.createElement('option'), { value: option.value, textContent: option.value });
      el.selected = option.value === value;
      el.disabled = !option.packageId;
      created.append(el);
    }
    created.addEventListener('change', () => choose(code, created.value));
    if (!host.hasAttribute('next-render-no-label')) field.append(label);
    field.append(created);
    const old = drawn.find((f) => f.dataset.nextVariantCode === code);
    if (old) old.replaceWith(field);
    else host.append(field);
  }
  for (const f of drawn) if (!choices.some((c) => c.code === f.dataset.nextVariantCode)) f.remove();
}

function renderStage(
  engine: Engine,
  selectorId: string,
  stage: Element,
  template: string,
  cards: Map<string, Element>,
) {
  let shown = '';
  const rendered: Array<{
    el: HTMLElement;
    slot: Slot;
    values: Values;
    prices: Values;
    patch: (values: Values) => void;
    variants: () => void;
    boxes: Array<{ box: HTMLElement; tpl: string; html: string }>;
  }> = [];

  const valuesOf = (selector: SelectorState, card: SelectorCard, slot: Slot, index: number, held?: Values) => {
    const pkg = engine.getPackage(slot.packageId);
    const fresh = cardQuote(selector, card);
    const pending = !fresh && !!selector.quoting;
    const quote = fresh ?? (pending ? selector.quotes?.[card.id] : undefined);
    const line = quote?.lines.find((l) => l.package_id === slot.packageId);
    const prices = !line && pending && held ? held : priceValues(engine, pkg, line);
    return { prices, values: { ...itemValues(engine, pkg, index), ...prices } };
  };

  const apply = (card: SelectorCard, index: number, patch: Partial<Slot>) =>
    engine.selectors.setSlot(selectorId, card.id, index, patch);

  const properties = (card: SelectorCard, el: Element) => ({
    ...pageProperties(cards.get(card.id)),
    ...ownProperties(el),
  });

  const refresh = ({ el, slot, boxes }: (typeof rendered)[number]) => {
    const { cart, selectors } = engine.getState();
    const pending = cart.calculating || !!selectors[selectorId]?.quoting;
    for (const entry of boxes) {
      const { box, tpl } = entry;
      const found = discounts(engine, slot.packageId, box.getAttribute('data-next-discounts') ?? 'offer', pending);
      if (found)
        entry.html = found
          .map((d) =>
            fill(tpl, {
              'discount.percentage': discountPercent(d.percentage, localeOf(engine.getState())),
              'discount.name': d.name ?? '',
              'discount.amount': format(
                { type: 'money', value: dollars(d.amount) },
                engine.getState().campaign?.currency,
                localeOf(engine.getState()),
              ),
            }),
          )
          .join('');
      if (box.innerHTML !== entry.html) box.innerHTML = entry.html;
    }
    applyValues(el, engine);
  };

  const renderSlot = (
    card: SelectorCard,
    slot: Slot,
    index: number,
    { values, prices }: ReturnType<typeof valuesOf>,
  ): (typeof rendered)[number] => {
    const el = Object.assign(document.createElement('div'), { className: 'next-bundle-slot' });
    Object.assign(el.dataset, { nextBundleId: card.id, nextSlotIndex: String(index) });
    const inert = document.createElement('template');
    inert.innerHTML = template;
    const patch = bindTokens(inert.content);
    patch(values);
    el.append(inert.content);
    const boxes = [...el.querySelectorAll<HTMLElement>('[data-next-discounts]')].map((box) => ({
      box,
      tpl: box.querySelector('template')?.innerHTML ?? '',
      html: '',
    }));
    const entry = { el, slot, values, prices, patch, boxes, variants: () => {} };
    const choose = (code: string, value: string) => {
      const choice = variantChoices(engine.getState().campaign?.packages ?? [], entry.slot.packageId).find(
        (c) => c.code === code,
      );
      const packageId = choice?.options.find((o) => o.value === value)?.packageId;
      if (packageId) void apply(card, index, { packageId });
    };
    entry.variants = () => {
      for (const host of el.querySelectorAll('[data-next-variant-selectors]'))
        variantSelects(engine, host, entry.slot, choose);
    };
    entry.variants();
    for (const input of el.querySelectorAll<HTMLInputElement>('[data-next-property]')) {
      const name = input.getAttribute('data-next-property')!;
      input.value = slot.properties?.[name] ?? '';
      input.addEventListener('change', () => void apply(card, index, { properties: properties(card, el) }));
    }
    refresh(entry);
    return entry;
  };

  for (const input of document.querySelectorAll('[data-next-default-property]')) {
    input.addEventListener('change', () => {
      const card = pickedCard(engine.getState().selectors[selectorId]);
      if (card) rendered.forEach(({ el }, i) => void apply(card, i, { properties: properties(card, el) }));
    });
  }

  return () => {
    const selector = engine.getState().selectors[selectorId];
    const card = pickedCard(selector);
    if (!selector || !card) return;
    const slots = cardSlots(selector, card);
    const key = `${card.id}:${slots.length}:${engine.getState().campaign ? 1 : 0}`;
    if (key !== shown) {
      shown = key;
      rendered.splice(
        0,
        rendered.length,
        ...slots.map((slot, i) => renderSlot(card, slot, i, valuesOf(selector, card, slot, i))),
      );
      stage.replaceChildren(...rendered.map((r) => r.el));
      return;
    }
    slots.forEach((slot, i) => {
      const entry = rendered[i];
      if (!entry) return;
      const { values, prices } = valuesOf(selector, card, slot, i, entry.prices);
      const moved = entry.slot.packageId !== slot.packageId;
      Object.assign(entry, { slot, prices });
      if (JSON.stringify(entry.values) !== JSON.stringify(values)) {
        entry.values = values;
        entry.patch(values);
      }
      if (moved) entry.variants();
      refresh(entry);
    });
  };
}

export function bindSlots(engine: Engine): () => void {
  const renders = [...document.querySelectorAll('[data-next-bundle-selector]')].flatMap((selectorEl) => {
    const templateId = selectorEl.getAttribute('data-next-bundle-slot-template-id');
    const source = templateId ? document.getElementById(templateId) : null;
    const template = source?.innerHTML ?? selectorEl.getAttribute('data-next-bundle-slot-template');
    const selectorId = selectorIdOf(selectorEl);
    const stage = document.querySelector(`[data-next-bundle-slots-for="${selectorId}"]`);
    if (!template || !stage) return [];
    const cards = new Map(
      [...selectorEl.querySelectorAll('[data-next-bundle-card]')].map((el, i) => [
        el.getAttribute('data-next-bundle-id') || String(i),
        el,
      ]),
    );
    return [renderStage(engine, selectorId, stage, template, cards)];
  });
  const render = () => renders.forEach((r) => r());
  engine.subscribe(render);
  render();
  return render;
}
