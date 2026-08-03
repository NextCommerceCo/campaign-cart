/**
 * Line and discount list rendering for CartSummary — builds the DOM for
 * `[data-summary-lines]`, `[data-summary-offer-discounts]`,
 * `[data-summary-voucher-discounts]` and per-line `[data-line-discounts]`
 * containers from their `<template>` children.
 *
 * Split out of `./cart-summary.renderer` (summary-level rendering stays
 * there) to keep each file under the size limit.
 */

import {
  formatCurrency,
  formatDiscountPercentage,
  formatPercentage,
} from '@/core/currency-formatter';
import type { CartSummary, SummaryLine } from '@/types/api';
import type { DiscountItem } from './cart-summary.types';
import {
  buildItemContext,
  buildDiscountContext,
  computeFrequency,
} from './cart-summary.condition-context';
import { applyLocalConditions } from './cart-summary.conditions';
import {
  renderDiscountContainers,
  renderFlatDiscountContainers,
  replaceVarsPreservingTemplates,
} from '@/core/rendering/discount-renderer';

function htmlToElement(html: string): Element | null {
  const wrapper = document.createElement('div');
  wrapper.innerHTML = html;
  return wrapper.firstElementChild;
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function renderListContainers(
  element: HTMLElement,
  summary: CartSummary | undefined,
  warn?: (msg: string) => void
): void {
  renderLines(element, summary, warn);
  renderDiscountList(
    element,
    '[data-summary-offer-discounts]',
    summary?.offer_discounts ?? [],
    warn
  );
  renderDiscountList(
    element,
    '[data-summary-voucher-discounts]',
    summary?.voucher_discounts ?? [],
    warn
  );
  renderDiscountContainers(element, {
    offerDiscounts: summary?.offer_discounts ?? [],
    voucherDiscounts: summary?.voucher_discounts ?? [],
  });
}

export function renderLines(
  element: HTMLElement,
  summary: CartSummary | undefined,
  warn?: (msg: string) => void
): void {
  const container = element.querySelector<HTMLElement>('[data-summary-lines]');
  if (!container) return;
  const templateEl = container.querySelector(
    ':scope > template'
  ) as HTMLTemplateElement | null;
  if (!templateEl) return;

  const itemTemplate = templateEl.innerHTML.trim();

  clearListItems(container);

  const lines: SummaryLine[] = (summary?.lines ?? []).sort(
    (a, b) => a.package_id - b.package_id
  );
  const isEmpty = lines.length === 0;
  container.classList.toggle('next-summary-empty', isEmpty);
  container.classList.toggle('next-summary-has-items', !isEmpty);
  lines.forEach(line => {
    const node = buildLineElement(itemTemplate, line, warn);
    if (node) container.appendChild(node);
  });
}

export function buildLineElement(
  template: string,
  line: SummaryLine,
  warn?: (msg: string) => void
): Element | null {
  const itemCtx = buildItemContext(line);
  const wrapper = document.createElement('div');
  wrapper.innerHTML = renderSummaryLine(template, line);
  const el = wrapper.firstElementChild ?? wrapper;

  // Evaluate item.* / line.* conditions on the line itself. The line discount
  // template (still inside <template>) lives in an inert document fragment, so
  // querySelectorAll inside applyLocalConditions does not descend into it.
  const visible = applyLocalConditions(
    el,
    { item: itemCtx, line: itemCtx },
    warn
  );
  if (!visible) return null;

  const discountContainer = el.querySelector<HTMLElement>(
    '[data-line-discounts]'
  );
  if (discountContainer) {
    const discountTemplateEl = discountContainer.querySelector(
      ':scope > template'
    ) as HTMLTemplateElement | null;
    if (discountTemplateEl) {
      const discountTemplate = discountTemplateEl.innerHTML.trim();
      const isEmpty = line.discounts.length === 0;
      discountContainer.classList.toggle('next-summary-empty', isEmpty);
      discountContainer.classList.toggle('next-summary-has-items', !isEmpty);

      for (const d of line.discounts) {
        const node = htmlToElement(renderDiscountItem(discountTemplate, d));
        if (!node) continue;
        const discountVisible = applyLocalConditions(
          node,
          {
            item: itemCtx,
            line: itemCtx,
            discount: buildDiscountContext(d),
          },
          warn
        );
        if (!discountVisible) continue;
        discountContainer.appendChild(node);
      }
    }
  }

  renderFlatDiscountContainers(el as HTMLElement, line.discounts);

  // Render dynamic property list — [data-next-item-properties] with <template> child.
  // Template tokens: {property.key}, {property.value}
  const propertiesContainer = el.querySelector<HTMLElement>(
    '[data-next-item-properties]'
  );
  if (propertiesContainer) {
    const propTemplate = propertiesContainer.querySelector(
      ':scope > template'
    ) as HTMLTemplateElement | null;
    if (propTemplate) {
      const tmpl = propTemplate.innerHTML.trim();
      const entries = Object.entries(line.properties ?? {});
      propertiesContainer.classList.toggle(
        'next-summary-empty',
        entries.length === 0
      );
      propertiesContainer.classList.toggle(
        'next-summary-has-items',
        entries.length > 0
      );
      for (const [key, value] of entries) {
        const html = tmpl
          .replace(/\{property\.key\}/g, escapeHtml(key))
          .replace(/\{property\.value\}/g, escapeHtml(value));
        const node = htmlToElement(html);
        if (node) propertiesContainer.appendChild(node);
      }
    }
  }

  return el;
}

export function renderDiscountList(
  element: HTMLElement,
  selector: string,
  items: DiscountItem[],
  warn?: (msg: string) => void
): void {
  const container = element.querySelector<HTMLElement>(selector);
  if (!container) return;
  const templateEl = container.querySelector(
    ':scope > template'
  ) as HTMLTemplateElement | null;
  if (!templateEl) return;

  const itemTemplate = templateEl.innerHTML.trim();
  clearListItems(container);

  const isEmpty = items.length === 0;
  container.classList.toggle('next-summary-empty', isEmpty);
  container.classList.toggle('next-summary-has-items', !isEmpty);

  for (const d of items) {
    const node = htmlToElement(renderDiscountItem(itemTemplate, d));
    if (!node) continue;
    const visible = applyLocalConditions(
      node,
      { discount: buildDiscountContext(d) },
      warn
    );
    if (!visible) continue;
    container.appendChild(node);
  }
}

export function clearListItems(container: HTMLElement): void {
  Array.from(container.childNodes).forEach(node => {
    if ((node as Element).tagName?.toLowerCase() !== 'template') {
      node.parentNode?.removeChild(node);
    }
  });
}

export function renderDiscountItem(
  template: string,
  discount: DiscountItem
): string {
  return template.replace(/\{([^}]+)\}/g, (_, key: string) => {
    switch (key) {
      case 'discount.name':
        return discount.name ?? '';
      case 'discount.amount':
        return discount.amount ?? '';
      case 'discount.description':
        return discount.description ?? '';
      case 'discount.percentage':
        return formatDiscountPercentage(discount.percentage);
      default:
        return '';
    }
  });
}

export function renderSummaryLine(template: string, line: SummaryLine): string {
  const hasDiscount = parseFloat(line.total_discount) > 0;

  const origUnit = parseFloat(line.original_unit_price);
  const unit = parseFloat(line.unit_price);
  const discountPctNum =
    origUnit > 0 && origUnit > unit
      ? Math.round(((origUnit - unit) / origUnit) * 100)
      : 0;
  const discountPct = formatPercentage(discountPctNum);

  const vars: Record<string, string> = {
    'item.packageId': String(line.package_id),
    'item.name': line.name ?? '',
    'item.image': line.image ?? '',
    'item.quantity': String(line.quantity),
    'item.variantName': line.product_variant_name ?? '',
    'item.productName': line.product_name ?? '',
    'item.sku': line.product_sku ?? '',
    'item.isRecurring': line.is_recurring ? 'true' : 'false',
    'item.interval': line.interval ?? '',
    'item.intervalCount':
      line.interval_count != null ? String(line.interval_count) : '',
    'item.frequency': computeFrequency(line.interval, line.interval_count),
    'item.recurringPrice':
      line.price_recurring != null
        ? formatCurrency(line.price_recurring, line.currency ?? undefined)
        : '',
    'item.originalRecurringPrice':
      line.original_recurring_price != null
        ? formatCurrency(
            line.original_recurring_price,
            line.currency ?? undefined
          )
        : '',
    'item.price': formatCurrency(line.total, line.currency ?? undefined),
    'item.originalPrice': formatCurrency(
      line.subtotal,
      line.currency ?? undefined
    ),
    'item.unitPrice': formatCurrency(
      line.unit_price,
      line.currency ?? undefined
    ),
    'item.originalUnitPrice': formatCurrency(
      line.original_unit_price,
      line.currency ?? undefined
    ),
    'item.discountAmount': formatCurrency(
      line.total_discount,
      line.currency ?? undefined
    ),
    'item.discountPercentage': discountPct,
    'item.hasDiscount': hasDiscount ? 'show' : 'hide',
    'item.currency': line.currency ?? '',
  };

  if (line.properties) {
    for (const [key, value] of Object.entries(line.properties)) {
      vars[`item.property.${key}`] = value;
    }
  }

  // Mirror every item.* token as a line.* alias so templates can use either
  // vocabulary interchangeably. Pre-v0.4.11 legacy line.* names that no longer
  // exist in the item.* namespace (line.qty, line.priceTotal, line.packagePrice,
  // line.totalDiscount, line.subtotal, line.total, line.priceRetail, etc.) are
  // intentionally NOT restored — they will resolve to empty strings.
  for (const [key, value] of Object.entries(vars)) {
    if (key.startsWith('item.')) {
      vars[key.replace(/^item\./, 'line.')] = value;
    }
  }

  return replaceVarsPreservingTemplates(template, vars);
}
