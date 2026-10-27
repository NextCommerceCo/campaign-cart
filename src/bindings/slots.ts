import type { Engine } from '../engine/engine';
import { cardSlots, pickedCard } from '../engine/selectors';
import type { Discount, Package, Selector, SelectorCard, Slot, SummaryLine } from '../engine/types';
import { cardQuote, cents, discountPercent, format } from '../engine/values';
import { applyValues, ownProperties, pageProperties, selectorIdOf, setVisible } from './dom';

const escape = (text: string) =>
  text.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

const fill = (html: string, values: Record<string, string>) =>
  html.replace(/\{((?:slot|item|discount)\.\w+)\}/g, (raw, key: string) =>
    key in values ? escape(values[key]!) : raw,
  );

function itemValues(
  engine: Engine,
  pkg: Package | undefined,
  index: number,
  line?: SummaryLine,
): Record<string, string> {
  const { campaign } = engine.getState();
  const money = (c: number) => format({ type: 'money', value: c / 100 }, campaign?.currency, campaign?.language);
  const unit = line ? cents(line.package_price) : cents(pkg?.price);
  const retail = line ? cents(line.original_package_price) : cents(pkg?.price_retail ?? pkg?.price);
  const total = line ? unit : cents(pkg?.price_total);
  const retailTotal = line ? retail : cents(pkg?.price_retail_total ?? pkg?.price_total);
  const saved = Math.max(0, retailTotal - total);
  const off = line ? Math.max(0, cents(line.total_discount)) : saved;
  const base = line ? cents(line.subtotal) : retailTotal;
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
    'item.price': money(total),
    'item.originalPrice': money(retailTotal),
    'item.unitPrice': money(unit),
    'item.originalUnitPrice': money(retail),
    'item.discountAmount': money(saved),
    'item.discountPercentage': base ? `${Math.round((off / base) * 100)}%` : '0%',
    'item.hasDiscount': off > 0 ? 'show' : 'hide',
    'item.currency': campaign?.currency ?? '',
  };
}

function discounts(engine: Engine, packageId: number, kind: string): Discount[] {
  const summary = engine.getState().cart.summary;
  const pool = new Set(
    (kind === 'voucher' ? summary?.voucher_discounts : summary?.offer_discounts)?.map((d) => d.offer_id),
  );
  const line = summary?.lines.find((l) => l.package_id === packageId);
  return (line?.discounts ?? []).filter((d) => pool.has(d.offer_id));
}

function variantSelects(engine: Engine, host: Element, slot: Slot, choose: (packageId: number) => void): void {
  const packages = engine.getState().campaign?.packages ?? [];
  const current = packages.find((p) => p.ref_id === slot.packageId);
  const own = current?.product_variant_attribute_values ?? [];
  if (!current?.product_id || !own.length) return;
  const family = packages.filter((p) => p.product_id === current.product_id);
  const codes = new Map(family.flatMap((p) => p.product_variant_attribute_values ?? []).map((a) => [a.code, a.name]));
  const selected = Object.fromEntries(own.map((a) => [a.code, a.value]));
  const matching = (wanted: Record<string, string>) =>
    family.find(
      (p) =>
        p.product_purchase_availability !== 'unavailable' &&
        Object.entries(wanted).every(([code, value]) =>
          p.product_variant_attribute_values?.some((a) => a.code === code && a.value === value),
        ),
    );
  const fields = [...codes].map(([code, name]) => {
    const field = Object.assign(document.createElement('div'), { className: 'next-slot-variant-field' });
    Object.assign(field.dataset, { nextVariantCode: code, nextVariantName: name });
    const label = Object.assign(document.createElement('label'), {
      className: 'next-slot-variant-label',
      textContent: `Select ${name}:`,
    });
    const select = Object.assign(document.createElement('select'), { className: 'next-slot-variant-select' });
    select.dataset.nextVariantCode = code;
    const values = [
      ...new Set(
        family
          .flatMap((p) => p.product_variant_attribute_values ?? [])
          .filter((a) => a.code === code)
          .map((a) => a.value),
      ),
    ];
    for (const value of values) {
      const option = Object.assign(document.createElement('option'), { value, textContent: value });
      option.selected = value === selected[code];
      option.disabled = !matching({ ...selected, [code]: value });
      select.append(option);
    }
    select.addEventListener('change', () => {
      const pkg = matching({ ...selected, [code]: select.value });
      if (pkg) choose(pkg.ref_id);
    });
    if (!host.hasAttribute('next-render-no-label')) field.append(label);
    field.append(select);
    return field;
  });
  host.replaceChildren(...fields);
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
    values: Record<string, string>;
    boxes: Array<{ box: HTMLElement; tpl: string }>;
  }> = [];

  const valuesOf = (selector: Selector, card: SelectorCard, slot: Slot, index: number) =>
    itemValues(
      engine,
      engine.getPackage(slot.packageId),
      index,
      cardQuote(selector, card)?.lines.find((l) => l.package_id === slot.packageId),
    );

  const apply = (card: SelectorCard, index: number, patch: Partial<Slot>) =>
    engine.selectors.setSlot(selectorId, card.id, index, patch);

  const properties = (card: SelectorCard, el: Element) => ({
    ...pageProperties(cards.get(card.id)),
    ...ownProperties(el),
  });

  const refresh = ({ el, slot, boxes }: (typeof rendered)[number]) => {
    for (const { box, tpl } of boxes) {
      const found = discounts(engine, slot.packageId, box.getAttribute('data-next-discounts') ?? 'offer');
      box.innerHTML = found
        .map((d) =>
          fill(tpl, {
            'discount.percentage': discountPercent(d.percentage, engine.getState().campaign?.language),
            'discount.name': d.name ?? '',
            'discount.amount': format(
              { type: 'money', value: cents(d.amount) / 100 },
              engine.getState().campaign?.currency,
              engine.getState().campaign?.language,
            ),
          }),
        )
        .join('');
    }
    applyValues(el, engine);
  };

  const renderSlot = (
    card: SelectorCard,
    slot: Slot,
    index: number,
    values: Record<string, string>,
  ): (typeof rendered)[number] => {
    const el = Object.assign(document.createElement('div'), { className: 'next-bundle-slot' });
    Object.assign(el.dataset, { nextBundleId: card.id, nextSlotIndex: String(index) });
    el.innerHTML = fill(template, values);
    for (const attr of ['data-next-show', 'data-next-hide'] as const) {
      for (const node of el.querySelectorAll<HTMLElement>(`[${attr}^="item."]`)) {
        const on = values[node.getAttribute(attr)!] === 'show';
        setVisible(node, attr === 'data-next-show' ? on : !on);
        node.removeAttribute(attr);
      }
    }
    const boxes = [...el.querySelectorAll<HTMLElement>('[data-next-discounts]')].map((box) => ({
      box,
      tpl: box.querySelector('template')?.innerHTML ?? '',
    }));
    for (const host of el.querySelectorAll('[data-next-variant-selectors]')) {
      variantSelects(engine, host, slot, (packageId) => void apply(card, index, { packageId }));
    }
    for (const input of el.querySelectorAll<HTMLInputElement>('[data-next-property]')) {
      const name = input.getAttribute('data-next-property')!;
      input.value = slot.properties?.[name] ?? '';
      input.addEventListener('change', () => void apply(card, index, { properties: properties(card, el) }));
    }
    const entry = { el, slot, values, boxes };
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
      const old = rendered[i];
      if (!old) return;
      const values = valuesOf(selector, card, slot, i);
      if (old.slot.packageId === slot.packageId && JSON.stringify(old.values) === JSON.stringify(values)) {
        old.slot = slot;
        return refresh(old);
      }
      const code =
        (document.activeElement as HTMLElement | null)?.closest('.next-bundle-slot') === old.el
          ? (document.activeElement as HTMLElement).getAttribute('data-next-variant-code')
          : null;
      const next = renderSlot(card, slot, i, values);
      old.el.replaceWith(next.el);
      rendered[i] = next;
      if (code) next.el.querySelector<HTMLElement>(`select[data-next-variant-code="${code}"]`)?.focus();
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
