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
import type { CartState, CartTotals } from '@/types/global';
import type { CartSummary } from '@/types/api';
import {
  buildFlags,
  buildVars,
  renderDefault,
  renderCustom,
  updateStateClasses,
} from './CartSummaryEnhancer.renderer';

export class CartSummaryEnhancer extends BaseEnhancer {
  private customTemplate?: string;
  private totals?: CartTotals;
  private summary?: CartSummary;
  private itemCount: number = 0;

  public async initialize(): Promise<void> {
    this.validateElement();

    this.customTemplate = this.resolveTemplate();

    const state = useCartStore.getState();
    this.totals    = state.totals;
    this.summary   = state.summary;
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
    const vars  = buildVars(this.totals, flags, this.itemCount);

    updateStateClasses(this.element, flags);

    if (this.customTemplate) {
      renderCustom(this.element, this.customTemplate, vars, this.summary);
    } else {
      renderDefault(this.element, vars, flags);
    }
  }

  /**
   * Looks for a <template> child element and returns its inner HTML.
   * Returns undefined if none found — the built-in default is used instead.
   */
  private resolveTemplate(): string | undefined {
    const templateEl = this.element.querySelector(':scope > template') as HTMLTemplateElement | null;
    return templateEl?.innerHTML.trim() || undefined;
  }
}
