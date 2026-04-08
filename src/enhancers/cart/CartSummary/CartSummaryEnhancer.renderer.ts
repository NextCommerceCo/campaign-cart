import { formatCurrency, formatPercentage } from '@/utils/currencyFormatter';
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
  currency: string,
): TemplateVars {
  const fmt = (n: number) => formatCurrency(n, currency);
  const pct = (n: number) => formatPercentage(n);
  const totalQuantity = state.items.reduce((sum, item) => sum + item.quantity, 0);

  return {
    // totals
    subtotal: fmt(state.subtotal.toNumber()),
    total:    fmt(state.total.toNumber()),

    // shipping
    shippingName:               state.shippingMethod?.name ?? '',
    shippingCode:               state.shippingMethod?.code ?? '',
    shipping:                   flags.isFreeShipping ? 'Free' : fmt(state.shippingMethod?.price.toNumber() ?? 0),
    shippingOriginal:           flags.hasShippingDiscount
      ? fmt(state.shippingMethod?.originalPrice.toNumber() ?? 0)
      : '',
    shippingDiscountAmount:     fmt(state.shippingMethod?.discountAmount.toNumber() ?? 0),
    shippingDiscountPercentage: pct(state.shippingMethod?.discountPercentage.toNumber() ?? 0),

    // discounts
    totalDiscount:           fmt(state.totalDiscount.toNumber()),
    totalDiscountPercentage: pct(state.totalDiscountPercentage.toNumber()),
    discounts:               fmt(state.totalDiscount.toNumber()),

    // currency
    currency:       currency,

    // cart utils
    isCalculating:      String(flags.isCalculating),
    isEmpty:            String(flags.isEmpty),
    itemCount:          String(itemCount),
    totalQuantity:      String(totalQuantity),
    isFreeShipping:     String(flags.isFreeShipping),
    hasShippingDiscount: String(flags.hasShippingDiscount),
    hasDiscounts:       String(flags.hasDiscounts),
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
  warn?: (msg: string) => void,
): void {
  const html = template.replace(/\{([^}]+)\}/g, (match, key: string) =>
    key in vars ? vars[key] : match
  );
  element.innerHTML = html;
  renderListContainers(element, summary, warn);
}

export function renderListContainers(
  element: HTMLElement,
  summary: CartSummary | undefined,
  warn?: (msg: string) => void,
): void {
  renderLines(element, summary, warn);
  renderDiscountList(element, '[data-summary-offer-discounts]', summary?.offer_discounts ?? []);
  renderDiscountList(element, '[data-summary-voucher-discounts]', summary?.voucher_discounts ?? []);
}

export function renderLines(
  element: HTMLElement,
  summary: CartSummary | undefined,
  warn?: (msg: string) => void,
): void {
  const container = element.querySelector<HTMLElement>('[data-summary-lines]');
  if (!container) return;
  const templateEl = container.querySelector(':scope > template') as HTMLTemplateElement | null;
  if (!templateEl) return;

  const itemTemplate = templateEl.innerHTML.trim();

  if (warn && /\{line\./.test(itemTemplate)) {
    const LINE_TO_ITEM: Record<string, string> = {
      'line.packageId':            'item.packageId',
      'line.name':                 'item.name',
      'line.image':                'item.image',
      'line.qty':                  'item.quantity',
      'line.quantity':             'item.quantity',
      'line.productName':          'item.productName',
      'line.variantName':          'item.variantName',
      'line.sku':                  'item.sku',
      'line.isRecurring':          'item.isRecurring',
      'line.priceRecurring':       'item.recurringPrice',
      'line.priceRecurringTotal':  'item.recurringPrice',
      'line.unitPrice':            'item.unitPrice',
      'line.originalUnitPrice':    'item.originalUnitPrice',
      'line.packagePrice':         'item.price',
      'line.originalPackagePrice': 'item.originalPrice',
      'line.totalDiscount':        'item.discountAmount',
      'line.hasDiscount':          'item.hasDiscount',
      'line.subtotal':             'item.price',
      'line.total':                'item.price',
      'line.price':                '(no equivalent — use item.unitPrice or item.price)',
      'line.priceTotal':           '(no equivalent — use item.price)',
      'line.priceRetail':          '(no equivalent — use item.originalUnitPrice)',
      'line.priceRetailTotal':     '(no equivalent — use item.originalPrice)',
      'line.hasSavings':           '(no equivalent — derive from item.hasDiscount)',
    };
    const used = [...itemTemplate.matchAll(/\{(line\.[^}]+)\}/g)].map(m => m[1]);
    const unique = [...new Set(used)];
    const fixes = unique.map(token => {
      const replacement = LINE_TO_ITEM[token];
      return replacement
        ? `  {${token}} → {${replacement}}`
        : `  {${token}} → (no direct equivalent)`;
    });
    warn(
      `Deprecated line.* tokens found in [data-summary-lines] template:\n${fixes.join('\n')}`,
    );
  }

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

function computeFrequency(
  interval: 'day' | 'month' | null | undefined,
  count: number | null | undefined,
): string {
  if (!interval) return '';
  const n = count ?? 1;
  if (interval === 'day') return n === 1 ? 'Daily' : `Every ${n} days`;
  if (interval === 'month') return n === 1 ? 'Monthly' : `Every ${n} months`;
  return '';
}

export function renderSummaryLine(template: string, line: SummaryLine): string {
  const hasDiscount = parseFloat(line.total_discount) > 0;

  const origUnit = parseFloat(line.original_unit_price);
  const unit = parseFloat(line.unit_price);
  const discountPct =
    origUnit > 0 && origUnit > unit
      ? String(Math.round(((origUnit - unit) / origUnit) * 100))
      : '0';

  const vars: Record<string, string> = {
    'item.packageId':             String(line.package_id),
    'item.name':                  line.name                  ?? '',
    'item.image':                 line.image                 ?? '',
    'item.quantity':              String(line.quantity),
    'item.variantName':           line.product_variant_name  ?? '',
    'item.productName':           line.product_name          ?? '',
    'item.sku':                   line.product_sku           ?? '',
    'item.isRecurring':           line.is_recurring ? 'true' : 'false',
    'item.interval':              line.interval              ?? '',
    'item.intervalCount':         line.interval_count != null ? String(line.interval_count) : '',
    'item.frequency':             computeFrequency(line.interval, line.interval_count),
    'item.recurringPrice':        line.price_recurring != null ? formatCurrency(line.price_recurring, line.currency ?? undefined) : '',
    'item.originalRecurringPrice': line.original_recurring_price != null ? formatCurrency(line.original_recurring_price, line.currency ?? undefined) : '',
    'item.price':                 formatCurrency(line.package_price, line.currency ?? undefined),
    'item.originalPrice':         formatCurrency(line.original_package_price, line.currency ?? undefined),
    'item.unitPrice':             formatCurrency(line.unit_price, line.currency ?? undefined),
    'item.originalUnitPrice':     formatCurrency(line.original_unit_price, line.currency ?? undefined),
    'item.discountAmount':        formatCurrency(line.total_discount, line.currency ?? undefined),
    'item.discountPercentage':    discountPct,
    'item.hasDiscount':           hasDiscount ? 'show' : 'hide',
    'item.currency':              line.currency              ?? '',
  };

  return template.replace(/\{([^}]+)\}/g, (_, key: string) => vars[key] ?? '');
}
