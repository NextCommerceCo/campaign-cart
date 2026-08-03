import { formatCurrency, formatPercentage } from '@/core/currency-formatter';
import type { CartState } from '@/types/global';
import type { CartSummary } from '@/types/api';
import type { SummaryFlags, TemplateVars } from './cart-summary.types';
import { renderListContainers } from './cart-summary.line-renderer';

// Line and discount list rendering (renderListContainers, renderLines,
// buildLineElement, renderDiscountList, clearListItems, renderDiscountItem,
// renderSummaryLine) lives in ./cart-summary.line-renderer — re-exported here
// so existing imports of this module keep working unchanged.
export {
  renderListContainers,
  renderLines,
  buildLineElement,
  renderDiscountList,
  clearListItems,
  renderDiscountItem,
  renderSummaryLine,
} from './cart-summary.line-renderer';

// ─── Data builders ────────────────────────────────────────────────────────────

export function buildFlags(state: CartState): SummaryFlags {
  return {
    isEmpty: state.isEmpty,
    hasDiscounts: state.hasDiscounts,
    isFreeShipping: state.shippingMethod?.price.isZero() ?? true,
    hasShippingDiscount: state.shippingMethod?.hasDiscounts ?? false,
    isCalculating: state.isCalculating,
  };
}

export function buildVars(
  state: CartState,
  flags: SummaryFlags,
  itemCount: number,
  currency: string
): TemplateVars {
  const fmt = (n: number) => formatCurrency(n, currency);
  const pct = (n: number) => formatPercentage(n);
  const totalQuantity = state.items.reduce(
    (sum, item) => sum + item.quantity,
    0
  );

  return {
    // totals
    subtotal: fmt(state.subtotal.toNumber()),
    total: fmt(state.total.toNumber()),

    // shipping
    shippingName: state.shippingMethod?.name ?? '',
    shippingCode: state.shippingMethod?.code ?? '',
    shipping: flags.isFreeShipping
      ? 'Free'
      : fmt(state.shippingMethod?.price.toNumber() ?? 0),
    shippingOriginal: flags.hasShippingDiscount
      ? fmt(state.shippingMethod?.originalPrice.toNumber() ?? 0)
      : '',
    shippingDiscountAmount: fmt(
      state.shippingMethod?.discountAmount.toNumber() ?? 0
    ),
    shippingDiscountPercentage: pct(
      state.shippingMethod?.discountPercentage.toNumber() ?? 0
    ),

    // discounts
    totalDiscount: fmt(state.totalDiscount.toNumber()),
    totalDiscountPercentage: pct(state.totalDiscountPercentage.toNumber()),
    discounts: fmt(state.totalDiscount.toNumber()),

    // currency
    currency: currency,

    // cart utils
    isCalculating: String(flags.isCalculating),
    isEmpty: String(flags.isEmpty),
    itemCount: String(itemCount),
    totalQuantity: String(totalQuantity),
    isFreeShipping: String(flags.isFreeShipping),
    hasShippingDiscount: String(flags.hasShippingDiscount),
    hasDiscounts: String(flags.hasDiscounts),
  };
}

// ─── Default template ─────────────────────────────────────────────────────────

export function buildDefaultTemplate(
  vars: TemplateVars,
  flags: SummaryFlags
): string {
  const row = (label: string, value: string, cls = '') =>
    `<div class="next-summary-row${cls ? ` ${cls}` : ''}">` +
    `<span class="next-summary-label">${label}</span>` +
    `<span class="next-summary-value">${value}</span>` +
    `</div>`;

  return [
    row('Subtotal', vars.subtotal, 'next-row-subtotal'),
    flags.hasDiscounts
      ? row('Discounts', `-${vars.discounts}`, 'next-row-discounts')
      : '',
    row(
      'Shipping',
      flags.isFreeShipping ? 'Free' : vars.shipping,
      'next-row-shipping'
    ),
    row('Total', vars.total, 'next-row-total'),
  ].join('');
}

// ─── State classes ────────────────────────────────────────────────────────────

export function updateStateClasses(
  element: HTMLElement,
  flags: SummaryFlags
): void {
  element.classList.toggle('next-cart-empty', flags.isEmpty);
  element.classList.toggle('next-cart-has-items', !flags.isEmpty);
  element.classList.toggle('next-has-discounts', flags.hasDiscounts);
  element.classList.toggle('next-no-discounts', !flags.hasDiscounts);
  element.classList.toggle('next-has-shipping', !flags.isFreeShipping);
  element.classList.toggle('next-free-shipping', flags.isFreeShipping);
  element.classList.toggle(
    'next-has-shipping-discount',
    flags.hasShippingDiscount
  );
  element.classList.toggle(
    'next-no-shipping-discount',
    !flags.hasShippingDiscount
  );
  element.classList.toggle('next-calculating', flags.isCalculating);
  element.classList.toggle('next-not-calculating', !flags.isCalculating);
}

// ─── Rendering ────────────────────────────────────────────────────────────────

export function renderDefault(
  element: HTMLElement,
  vars: TemplateVars,
  flags: SummaryFlags
): void {
  element.innerHTML = buildDefaultTemplate(vars, flags);
}

export function renderCustom(
  element: HTMLElement,
  template: string,
  vars: TemplateVars,
  summary: CartSummary | undefined,
  warn?: (msg: string) => void
): void {
  const html = template.replace(/\{([^}]+)\}/g, (match, key: string) =>
    key in vars ? vars[key] : match
  );
  element.innerHTML = html;
  renderListContainers(element, summary, warn);
}
