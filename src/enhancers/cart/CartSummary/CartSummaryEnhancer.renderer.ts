import { formatCurrency } from '@/utils/currencyFormatter';
import type { CartState } from '@/types/global';
import type { CartSummary, SummaryLine } from '@/types/api';
import type { DiscountItem, SummaryFlags, TemplateVars } from './CartSummaryEnhancer.types';

// ─── Data builders ────────────────────────────────────────────────────────────

export function buildFlags(state: CartState): SummaryFlags {
  return {
    isEmpty:             state.isEmpty,
    hasDiscounts:        state.hasDiscounts,
    isFreeShipping:      state.shippingMethod?.price.isZero() ?? true,
    hasShippingDiscount: state.shippingMethod?.hasDiscounts ?? false,
    isCalculating:       state.isCalculating,
  };
}

export function buildVars(
  state: CartState,
  flags: SummaryFlags,
  itemCount: number,
): TemplateVars {
  return {
    subtotal:         formatCurrency(state.subtotal.toNumber()),
    total:            formatCurrency(state.total.toNumber()),
    shipping:         flags.isFreeShipping ? 'Free' : formatCurrency(state.shippingMethod?.price.toNumber() ?? 0),
    shippingOriginal: flags.hasShippingDiscount
      ? formatCurrency(state.shippingMethod?.originalPrice.toNumber() ?? 0)
      : '',
    discounts:        formatCurrency(state.totalDiscount.toNumber()),
    itemCount:        String(itemCount),
  };
}

// ─── Default template ─────────────────────────────────────────────────────────

export function buildDefaultTemplate(vars: TemplateVars, flags: SummaryFlags): string {
  const row = (label: string, value: string, cls = '') =>
    `<div class="next-summary-row${cls ? ` ${cls}` : ''}">` +
    `<span class="next-summary-label">${label}</span>` +
    `<span class="next-summary-value">${value}</span>` +
    `</div>`;

  return [
    row('Subtotal', vars.subtotal, 'next-row-subtotal'),
    flags.hasDiscounts ? row('Discounts', `-${vars.discounts}`, 'next-row-discounts') : '',
    row('Shipping', flags.isFreeShipping ? 'Free' : vars.shipping, 'next-row-shipping'),
    row('Total', vars.total, 'next-row-total'),
  ].join('');
}

// ─── State classes ────────────────────────────────────────────────────────────

export function updateStateClasses(element: HTMLElement, flags: SummaryFlags): void {
  element.classList.toggle('next-cart-empty',     flags.isEmpty);
  element.classList.toggle('next-cart-has-items', !flags.isEmpty);
  element.classList.toggle('next-has-discounts',  flags.hasDiscounts);
  element.classList.toggle('next-no-discounts',  !flags.hasDiscounts);
  element.classList.toggle('next-has-shipping',          !flags.isFreeShipping);
  element.classList.toggle('next-free-shipping',          flags.isFreeShipping);
  element.classList.toggle('next-has-shipping-discount',  flags.hasShippingDiscount);
  element.classList.toggle('next-no-shipping-discount',  !flags.hasShippingDiscount);
  element.classList.toggle('next-calculating',     flags.isCalculating);
  element.classList.toggle('next-not-calculating', !flags.isCalculating);
}

// ─── Rendering ────────────────────────────────────────────────────────────────

export function renderDefault(
  element: HTMLElement,
  vars: TemplateVars,
  flags: SummaryFlags,
): void {
  element.innerHTML = buildDefaultTemplate(vars, flags);
}

export function renderCustom(
  element: HTMLElement,
  template: string,
  vars: TemplateVars,
  summary: CartSummary | undefined,
): void {
  const html = template.replace(/\{([^}]+)\}/g, (match, key: string) =>
    key in vars ? vars[key] : match
  );
  element.innerHTML = html;
  renderListContainers(element, summary);
}

export function renderListContainers(
  element: HTMLElement,
  summary: CartSummary | undefined,
): void {
  renderLines(element, summary);
  renderDiscountList(element, '[data-summary-offer-discounts]', summary?.offer_discounts ?? []);
  renderDiscountList(element, '[data-summary-voucher-discounts]', summary?.voucher_discounts ?? []);
}

export function renderLines(
  element: HTMLElement,
  summary: CartSummary | undefined,
): void {
  const container = element.querySelector<HTMLElement>('[data-summary-lines]');
  if (!container) return;
  const templateEl = container.querySelector(':scope > template') as HTMLTemplateElement | null;
  if (!templateEl) return;

  const itemTemplate = templateEl.innerHTML.trim();
  clearListItems(container);

  const lines: SummaryLine[] = (summary?.lines ?? []).sort((a, b) => a.package_id - b.package_id);
  const isEmpty = lines.length === 0;
  container.classList.toggle('next-summary-empty', isEmpty);
  container.classList.toggle('next-summary-has-items', !isEmpty);
  lines.forEach(line => container.appendChild(buildLineElement(itemTemplate, line)));
}

export function buildLineElement(template: string, line: SummaryLine): Element {
  const wrapper = document.createElement('div');
  wrapper.innerHTML = renderSummaryLine(template, line);
  const el = wrapper.firstElementChild ?? wrapper;

  const discountContainer = el.querySelector<HTMLElement>('[data-line-discounts]');
  if (discountContainer) {
    const discountTemplateEl = discountContainer.querySelector(':scope > template') as HTMLTemplateElement | null;
    if (discountTemplateEl) {
      const discountTemplate = discountTemplateEl.innerHTML.trim();
      const isEmpty = line.discounts.length === 0;
      discountContainer.classList.toggle('next-summary-empty', isEmpty);
      discountContainer.classList.toggle('next-summary-has-items', !isEmpty);
      discountContainer.insertAdjacentHTML(
        'beforeend',
        line.discounts.map(d => renderDiscountItem(discountTemplate, d)).join('')
      );
    }
  }

  return el;
}

export function renderDiscountList(
  element: HTMLElement,
  selector: string,
  items: DiscountItem[],
): void {
  const container = element.querySelector<HTMLElement>(selector);
  if (!container) return;
  const templateEl = container.querySelector(':scope > template') as HTMLTemplateElement | null;
  if (!templateEl) return;

  const itemTemplate = templateEl.innerHTML.trim();
  clearListItems(container);

  const isEmpty = items.length === 0;
  container.classList.toggle('next-summary-empty', isEmpty);
  container.classList.toggle('next-summary-has-items', !isEmpty);
  container.insertAdjacentHTML(
    'beforeend',
    items.map(d => renderDiscountItem(itemTemplate, d)).join('')
  );
}

export function clearListItems(container: HTMLElement): void {
  Array.from(container.childNodes).forEach(node => {
    if ((node as Element).tagName?.toLowerCase() !== 'template') {
      node.parentNode?.removeChild(node);
    }
  });
}

export function renderDiscountItem(template: string, discount: DiscountItem): string {
  return template.replace(/\{([^}]+)\}/g, (_, key: string) => {
    switch (key) {
      case 'discount.name':        return discount.name        ?? '';
      case 'discount.amount':      return discount.amount      ?? '';
      case 'discount.description': return discount.description ?? '';
      default:                     return '';
    }
  });
}

export function renderSummaryLine(template: string, line: SummaryLine): string {
  const hasDiscount = parseFloat(line.total_discount) > 0;
  const hasSavings = line.price_retail_total != null
    ? parseFloat(line.price_retail_total) > parseFloat(line.package_price)
    : hasDiscount;

  const vars: Record<string, string> = {
    'line.packageId':             String(line.package_id),
    'line.quantity':              String(line.quantity),
    'line.name':                  line.name                  ?? '',
    'line.image':                 line.image                 ?? '',
    'line.qty':                   line.qty != null ? String(line.qty) : '',
    'line.productName':           line.product_name          ?? '',
    'line.variantName':           line.product_variant_name  ?? '',
    'line.sku':                   line.product_sku           ?? '',
    'line.price':                 line.price                 ?? '',
    'line.priceTotal':            line.price_total           ?? '',
    'line.priceRetail':           line.price_retail          ?? '',
    'line.priceRetailTotal':      line.price_retail_total    ?? '',
    'line.priceRecurring':        line.price_recurring       ?? '',
    'line.priceRecurringTotal':   line.price_recurring_total ?? '',
    'line.isRecurring':           line.is_recurring ? 'true' : 'false',
    'line.unitPrice':             line.unit_price,
    'line.originalUnitPrice':     line.original_unit_price,
    'line.packagePrice':          line.package_price,
    'line.originalPackagePrice':  line.original_package_price,
    'line.subtotal':              line.subtotal,
    'line.totalDiscount':         line.total_discount,
    'line.total':                 line.total,
    'line.hasDiscount':           hasDiscount ? 'show' : 'hide',
    'line.hasSavings':            hasSavings  ? 'show' : 'hide',
  };

  return template.replace(/\{([^}]+)\}/g, (_, key: string) => vars[key] ?? '');
}
