/**
 * Cart Summary Enhancer
 * Renders a complete cart summary block with automatic reactivity.
 *
 * ─── USAGE ───────────────────────────────────────────────────────────────────
 *
 * Minimal — renders the built-in default template:
 *   <div data-next-cart-summary></div>
 *
 * Custom template — replaces the default with your own markup:
 *   <div data-next-cart-summary>
 *     <template>
 *       <div class="row"><span>Subtotal</span><span>{subtotal}</span></div>
 *       <div class="row"><span>Discounts</span><span>-{discounts}</span></div>
 *       <div class="row"><span>Shipping</span><span>{shipping}</span></div>
 *       <div class="row"><span>Total</span><span>{total}</span></div>
 *     </template>
 *   </div>
 *
 * ─── TEMPLATE VARIABLES ──────────────────────────────────────────────────────
 *
 *   {subtotal}          Subtotal before shipping and discounts
 *   {total}             Grand total
 *   {shipping}          Shipping cost (formatted, or "Free" if zero)
 *   {shippingOriginal}  Original shipping before any shipping discount (empty if no discount)
 *   {tax}               Tax amount
 *   {discounts}         Total discount amount (offer + voucher)
 *   {savings}           Total savings: retail (compare-at minus price) + applied discounts
 *   {compareTotal}      Compare-at total (before savings)
 *   {itemCount}         Number of items in cart
 *
 * ─── STATE CSS CLASSES (added to host element) ───────────────────────────────
 *
 *   next-cart-empty              cart is empty
 *   next-cart-has-items          cart has items
 *   next-has-discounts           discounts > 0
 *   next-no-discounts            discounts = 0
 *   next-has-shipping            shipping cost > 0
 *   next-free-shipping           shipping cost = 0
 *   next-has-shipping-discount   a shipping discount is applied
 *   next-no-shipping-discount    no shipping discount
 *   next-has-tax                 tax > 0
 *   next-no-tax                  tax = 0
 *   next-has-savings             retail or discount savings available
 *   next-no-savings              no savings
 *
 * Use these classes to show/hide rows with CSS:
 *   .next-no-discounts .discount-row { display: none }
 *
 * ─── SUMMARY LISTS ───────────────────────────────────────────────────────────
 *
 * Inside a custom <template> you can include list containers. Each container
 * uses a dedicated attribute and must include a <template> child for its row.
 *
 * Discount lists — {discount.name}, {discount.amount}, {discount.description}:
 *
 *   <ul data-summary-offer-discounts>
 *     <template><li>{discount.name} — -{discount.amount}</li></template>
 *   </ul>
 *
 *   <ul data-summary-voucher-discounts>
 *     <template><li>{discount.name}: -{discount.amount}</li></template>
 *   </ul>
 *
 * Line items — per-cart-line breakdown with full price and product detail:
 *
 *   <ul data-summary-lines>
 *     <template>
 *       <li>
 *         <img src="{line.image}" />
 *         <span>{line.name}</span>
 *         <span>{line.qty} × {line.unitPrice}</span>
 *         <span>{line.total}</span>
 *         <!-- Per-line discount breakdown (data-line-discounts) -->
 *         <ul data-line-discounts>
 *           <template><li>{discount.name} — -{discount.amount}</li></template>
 *         </ul>
 *       </li>
 *     </template>
 *   </ul>
 *
 * data-line-discounts renders each individual Discount on the line.
 * Variables: {discount.name}, {discount.amount}, {discount.description}
 * Receives next-summary-empty / next-summary-has-items classes.
 *
 *   Line item variables:
 *     {line.packageId}            Package ref_id
 *     {line.quantity}             Quantity (integer)
 *     {line.qty}                  Quantity (display alias)
 *     {line.name}                 Package display name
 *     {line.image}                Product image URL
 *     {line.productName}          Product name
 *     {line.variantName}          Variant name (if applicable)
 *     {line.sku}                  Product SKU
 *     {line.price}                Unit price from campaign data
 *     {line.priceTotal}           Line total from campaign data
 *     {line.priceRetail}          Retail (compare-at) unit price
 *     {line.priceRetailTotal}     Retail line total
 *     {line.priceRecurring}       Recurring unit price (subscriptions)
 *     {line.priceRecurringTotal}  Recurring line total (subscriptions)
 *     {line.isRecurring}          "true" | "false"
 *     {line.unitPrice}            Unit price after discounts (from API summary)
 *     {line.originalUnitPrice}    Unit price before discounts (from API summary)
 *     {line.packagePrice}         Package price after discounts (from API summary)
 *     {line.originalPackagePrice} Package price before discounts (from API summary)
 *     {line.subtotal}             Line subtotal (from API summary)
 *     {line.totalDiscount}        Total discount applied to line
 *     {line.total}                Line total after discounts
 *     {line.hasDiscount}          "show" if discount > 0, else "hide"
 *     {line.hasSavings}           "show" if retail or discount savings exist, else "hide"
 *
 * All list containers also receive:
 *   next-summary-empty      no items in the list
 *   next-summary-has-items  one or more items in the list
 *
 * @example Minimal
 * <div data-next-cart-summary></div>
 *
 * @example Custom with conditional discount row
 * <div data-next-cart-summary>
 *   <template>
 *     <div class="row"><span>Subtotal</span><span>{subtotal}</span></div>
 *     <div class="row discount-row"><span>Discounts</span><span>-{discounts}</span></div>
 *     <div class="row"><span>Total</span><span>{total}</span></div>
 *   </template>
 * </div>
 * <style>
 *   .next-no-discounts .discount-row { display: none }
 * </style>
 *
 * @example Custom with offer discount list
 * <div data-next-cart-summary>
 *   <template>
 *     <div class="row"><span>Subtotal</span><span>{subtotal}</span></div>
 *     <ul data-summary-offer-discounts>
 *       <template><li class="discount-item">{discount.name} — -{discount.amount}</li></template>
 *     </ul>
 *     <div class="row"><span>Total</span><span>{total}</span></div>
 *   </template>
 * </div>
 */

import { BaseEnhancer } from '@/enhancers/base/BaseEnhancer';
import { useCartStore } from '@/stores/cartStore';
import { formatCurrency } from '@/utils/currencyFormatter';
import type { CartState, CartTotals } from '@/types/global';
import type { CartSummary, SummaryLine } from '@/types/api';

// ─── Types ────────────────────────────────────────────────────────────────────

type TemplateVars = Record<string, string>;
type DiscountItem = { name?: string; amount: string; description?: string };

// ─── Default template ─────────────────────────────────────────────────────────

/** Built-in template. Rows are conditionally rendered — zero-value rows are omitted. */
function buildDefaultTemplate(vars: TemplateVars, flags: SummaryFlags): string {
  const row = (label: string, value: string, cls = '') =>
    `<div class="next-summary-row${cls ? ` ${cls}` : ''}">` +
    `<span class="next-summary-label">${label}</span>` +
    `<span class="next-summary-value">${value}</span>` +
    `</div>`;

  return [
    row('Subtotal', vars.subtotal, 'next-row-subtotal'),
    flags.hasDiscounts ? row('Discounts', `-${vars.discounts}`, 'next-row-discounts') : '',
    row('Shipping', flags.isFreeShipping ? 'Free' : vars.shipping, 'next-row-shipping'),
    flags.hasTax      ? row('Tax', vars.tax, 'next-row-tax') : '',
    row('Total', vars.total, 'next-row-total'),
  ].join('');
}

// ─── Flags ────────────────────────────────────────────────────────────────────

interface SummaryFlags {
  isEmpty: boolean;
  hasDiscounts: boolean;
  isFreeShipping: boolean;
  hasShippingDiscount: boolean;
  hasTax: boolean;
  hasSavings: boolean;
}

function buildFlags(totals: CartTotals): SummaryFlags {
  return {
    isEmpty:             totals.isEmpty,
    hasDiscounts:        totals.discounts.value > 0,
    isFreeShipping:      totals.shipping.value === 0,
    hasShippingDiscount: totals.shippingDiscount.value > 0,
    hasTax:              totals.tax.value > 0,
    hasSavings:          totals.hasTotalSavings, // retail savings OR applied discounts
  };
}

// ─── Enhancer ─────────────────────────────────────────────────────────────────

export class CartSummaryEnhancer extends BaseEnhancer {
  private customTemplate?: string;
  private totals?: CartTotals;
  private summary?: CartSummary;
  private itemCount: number = 0;

  public async initialize(): Promise<void> {
    this.validateElement();

    this.customTemplate = this.resolveTemplate();

    const state = useCartStore.getState();
    this.totals = state.totals;
    this.summary = state.summary;
    this.itemCount = state.items.length;

    this.subscribe(useCartStore, this.handleCartUpdate.bind(this));
    this.render();

    this.logger.debug('CartSummaryEnhancer initialized');
  }

  public update(): void {
    this.render();
  }

  // ─── Private ───────────────────────────────────────────────────────────────

  private handleCartUpdate(state: CartState): void {
    const totalsChanged  = state.totals  !== this.totals;
    const summaryChanged = state.summary !== this.summary;
    const countChanged   = state.items.length !== this.itemCount;

    if (totalsChanged || summaryChanged || countChanged) {
      this.totals    = state.totals;
      this.summary   = state.summary;
      this.itemCount = state.items.length;
      this.render();
    }
  }

  private render(): void {
    if (!this.totals) return;

    const flags = buildFlags(this.totals);
    const vars  = this.buildVars(this.totals, flags);

    this.updateStateClasses(flags);

    if (this.customTemplate) {
      this.renderCustom(vars);
    } else {
      this.renderDefault(vars, flags);
    }
  }

  private renderDefault(vars: TemplateVars, flags: SummaryFlags): void {
    this.element.innerHTML = buildDefaultTemplate(vars, flags);
  }

  private renderCustom(vars: TemplateVars): void {
    // Substitute scalar variables into template string
    const html = this.customTemplate!.replace(/\{([^}]+)\}/g, (match, key: string) =>
      key in vars ? vars[key] : match
    );
    this.element.innerHTML = html;

    // Populate any discount list containers inside the rendered output
    this.renderListContainers();
  }

  /** Find summary list containers in rendered output and populate them. */
  private renderListContainers(): void {
    this.renderLines();
    this.renderDiscountList('[data-summary-offer-discounts]', this.summary?.offer_discounts ?? []);
    this.renderDiscountList('[data-summary-voucher-discounts]', this.summary?.voucher_discounts ?? []);
  }

  private renderLines(): void {
    const container = this.element.querySelector<HTMLElement>('[data-summary-lines]');
    if (!container) return;
    const templateEl = container.querySelector(':scope > template') as HTMLTemplateElement | null;
    if (!templateEl) return;

    const itemTemplate = templateEl.innerHTML.trim();
    this.clearListItems(container);

    const lines: SummaryLine[] = (this.summary?.lines ?? []).sort((a, b) => a.package_id - b.package_id);
    const isEmpty = lines.length === 0;
    this.toggleElementClass('next-summary-empty', isEmpty, container);
    this.toggleElementClass('next-summary-has-items', !isEmpty, container);
    lines.forEach(line => container.appendChild(this.buildLineElement(itemTemplate, line)));
  }

  /**
   * Renders a single summary line into a DOM element, then populates any
   * [data-line-discounts] nested list inside it with the line's discount items.
   */
  private buildLineElement(template: string, line: SummaryLine): Element {
    const wrapper = document.createElement('div');
    wrapper.innerHTML = this.renderSummaryLine(template, line);
    const el = wrapper.firstElementChild ?? wrapper;

    const discountContainer = el.querySelector<HTMLElement>('[data-line-discounts]');
    if (discountContainer) {
      const discountTemplateEl = discountContainer.querySelector(':scope > template') as HTMLTemplateElement | null;
      if (discountTemplateEl) {
        const discountTemplate = discountTemplateEl.innerHTML.trim();
        const isEmpty = line.discounts.length === 0;
        this.toggleElementClass('next-summary-empty', isEmpty, discountContainer);
        this.toggleElementClass('next-summary-has-items', !isEmpty, discountContainer);
        discountContainer.insertAdjacentHTML(
          'beforeend',
          line.discounts.map(d => this.renderDiscountItem(discountTemplate, d)).join('')
        );
      }
    }

    return el;
  }

  private renderDiscountList(selector: string, items: DiscountItem[]): void {
    const container = this.element.querySelector<HTMLElement>(selector);
    if (!container) return;
    const templateEl = container.querySelector(':scope > template') as HTMLTemplateElement | null;
    if (!templateEl) return;

    const itemTemplate = templateEl.innerHTML.trim();
    this.clearListItems(container);

    const isEmpty = items.length === 0;
    this.toggleElementClass('next-summary-empty', isEmpty, container);
    this.toggleElementClass('next-summary-has-items', !isEmpty, container);
    container.insertAdjacentHTML(
      'beforeend',
      items.map(d => this.renderDiscountItem(itemTemplate, d)).join('')
    );
  }

  /** Remove all rendered children from a list container, keeping <template> intact. */
  private clearListItems(container: HTMLElement): void {
    Array.from(container.childNodes).forEach(node => {
      if ((node as Element).tagName?.toLowerCase() !== 'template') {
        node.parentNode?.removeChild(node);
      }
    });
  }

  private renderDiscountItem(template: string, discount: DiscountItem): string {
    return template.replace(/\{([^}]+)\}/g, (_, key: string) => {
      switch (key) {
        case 'discount.name':        return discount.name        ?? '';
        case 'discount.amount':      return discount.amount      ?? '';
        case 'discount.description': return discount.description ?? '';
        default:                     return '';
      }
    });
  }

  private renderSummaryLine(template: string, line: SummaryLine): string {
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
      // Campaign prices (formatted strings from campaign data)
      'line.price':                 line.price                 ?? '',
      'line.priceTotal':            line.price_total           ?? '',
      'line.priceRetail':           line.price_retail          ?? '',
      'line.priceRetailTotal':      line.price_retail_total    ?? '',
      'line.priceRecurring':        line.price_recurring       ?? '',
      'line.priceRecurringTotal':   line.price_recurring_total ?? '',
      'line.isRecurring':           line.is_recurring ? 'true' : 'false',
      // API summary prices (reflect applied offer/coupon discounts)
      'line.unitPrice':             line.unit_price,
      'line.originalUnitPrice':     line.original_unit_price,
      'line.packagePrice':          line.package_price,
      'line.originalPackagePrice':  line.original_package_price,
      'line.subtotal':              line.subtotal,
      'line.totalDiscount':         line.total_discount,
      'line.total':                 line.total,
      // Conditional helpers
      'line.hasDiscount':           hasDiscount ? 'show' : 'hide',
      'line.hasSavings':            hasSavings  ? 'show' : 'hide',
    };

    return template.replace(/\{([^}]+)\}/g, (_, key: string) => vars[key] ?? '');
  }

  // ─── State CSS classes ─────────────────────────────────────────────────────

  private updateStateClasses(flags: SummaryFlags): void {
    this.toggleClass('next-cart-empty',     flags.isEmpty);
    this.toggleClass('next-cart-has-items', !flags.isEmpty);
    this.toggleClass('next-has-discounts',  flags.hasDiscounts);
    this.toggleClass('next-no-discounts',  !flags.hasDiscounts);
    this.toggleClass('next-has-shipping',          !flags.isFreeShipping);
    this.toggleClass('next-free-shipping',          flags.isFreeShipping);
    this.toggleClass('next-has-shipping-discount',  flags.hasShippingDiscount);
    this.toggleClass('next-no-shipping-discount',  !flags.hasShippingDiscount);
    this.toggleClass('next-has-tax',        flags.hasTax);
    this.toggleClass('next-no-tax',        !flags.hasTax);
    this.toggleClass('next-has-savings',    flags.hasSavings);
    this.toggleClass('next-no-savings',    !flags.hasSavings);
  }

  private toggleElementClass(cls: string, on: boolean, el: HTMLElement = this.element): void {
    el.classList.toggle(cls, on);
  }

  // ─── Template vars ─────────────────────────────────────────────────────────

  private buildVars(totals: CartTotals, flags: SummaryFlags): TemplateVars {
    return {
      subtotal:     totals.subtotal.formatted,
      total:        totals.total.formatted,
      shipping:         flags.isFreeShipping ? 'Free' : totals.shipping.formatted,
      shippingOriginal: flags.hasShippingDiscount
        ? formatCurrency(totals.shipping.value + totals.shippingDiscount.value)
        : '',
      tax:          totals.tax.formatted,
      discounts:    totals.discounts.formatted,
      savings:      totals.totalSavings.formatted,   // retail + offer/coupon savings
      compareTotal: totals.compareTotal.formatted,
      itemCount:    String(this.itemCount),
    };
  }

  // ─── Template resolution ───────────────────────────────────────────────────

  /**
   * Looks for a <template> child element and returns its inner HTML.
   * Returns undefined if none found — the built-in default is used instead.
   */
  private resolveTemplate(): string | undefined {
    const templateEl = this.element.querySelector(':scope > template') as HTMLTemplateElement | null;
    return templateEl?.innerHTML.trim() || undefined;
  }
}
