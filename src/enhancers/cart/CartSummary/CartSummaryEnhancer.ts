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
 *   Totals
 *   {subtotal}                   Subtotal before shipping and discounts
 *   {total}                      Grand total after all discounts and shipping
 *
 *   Shipping
 *   {shippingName}               Display name of the selected shipping method
 *   {shippingCode}               Code of the selected shipping method
 *   {shipping}                   Shipping cost (formatted, or "Free" if zero)
 *   {shippingOriginal}           Original shipping before a shipping discount (empty if no discount)
 *   {shippingDiscountAmount}     Absolute discount applied to shipping
 *   {shippingDiscountPercentage} Shipping discount as a percentage of the original price
 *
 *   Discounts
 *   {totalDiscount}              Combined offer and voucher discount amount
 *   {totalDiscountPercentage}    Combined discount as a percentage of the subtotal
 *   {discounts}                  Alias for {totalDiscount} — kept for backwards compatibility
 *
 *   Currency
 *   {currency}                   Active currency code (e.g. "USD")
 *   {currencyCode}               Alias for {currency}
 *
 *   Cart utils
 *   {isCalculating}              "true" | "false" — totals recalculation in progress
 *   {isEmpty}                    "true" | "false" — cart has no items
 *   {itemCount}                  Number of lines in the cart
 *   {totalQuantity}              Total unit quantity across all cart lines
 *   {isFreeShipping}             "true" | "false" — shipping cost is zero
 *   {hasShippingDiscount}        "true" | "false" — a shipping discount is applied
 *   {hasDiscounts}               "true" | "false" — any discount is applied
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
 *   next-calculating             totals are being recalculated
 *   next-not-calculating         totals are up to date
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
 * ─── PER-LINE CONDITIONAL DISPLAY ────────────────────────────────────────────
 *
 * Inside any line / discount template you can use `data-next-show` and
 * `data-next-hide` with `item.*` and `discount.*` namespaces. Conditions are
 * evaluated synchronously at render time against raw line / discount data.
 * Hidden elements are removed from the DOM and their attributes are stripped.
 *
 *   <ul data-summary-lines>
 *     <template>
 *       <li>
 *         <span>{item.name}</span>
 *         <span data-next-show="item.quantity > 1">×{item.quantity}</span>
 *         <span data-next-hide="item.hasDiscount">{item.price}</span>
 *         <span data-next-show="item.isRecurring">Renews {item.frequency}</span>
 *       </li>
 *     </template>
 *   </ul>
 *
 *   <ul data-summary-offer-discounts>
 *     <template>
 *       <li data-next-show="discount.amount > 5">{discount.name} -{discount.amount}</li>
 *     </template>
 *   </ul>
 *
 * Notes:
 *   - Use the no-braces syntax — write `item.quantity > 1`, not `{item.quantity} > 1`.
 *   - `item.*` is available inside `[data-summary-lines]` and `[data-line-discounts]`.
 *   - `discount.*` is available inside any discount template; per-line discount
 *     templates also expose the parent `item.*`.
 *   - Conditions referencing other namespaces (e.g. `cart.hasItems`) are left
 *     untouched and processed by the global ConditionalDisplayEnhancer flow.
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
import { useCampaignStore } from '@/stores/campaignStore';
import { useConfigStore } from '@/stores/configStore';
import type { CartState } from '@/types/global';
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
  private cartState?: CartState;
  private summary?: CartSummary;
  private itemCount: number = 0;

  public async initialize(): Promise<void> {
    this.validateElement();

    this.customTemplate = this.resolveTemplate();

    const state = useCartStore.getState();
    this.cartState = state;
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
    const totalsChanged      = state.subtotal !== this.cartState?.subtotal
      || state.total !== this.cartState?.total;
    const summaryChanged     = state.summary !== this.summary;
    const countChanged       = state.items.length !== this.itemCount;
    const calculatingChanged = state.isCalculating !== this.cartState?.isCalculating;

    if (totalsChanged || summaryChanged || countChanged || calculatingChanged) {
      this.cartState = state;
      this.summary   = state.summary;
      this.itemCount = state.items.length;
      this.render();
    }
  }

  private render(): void {
    if (!this.cartState) return;

    const campaign = useCampaignStore.getState().data;
    const config   = useConfigStore.getState();
    const currency =
      campaign?.currency ??
      config?.selectedCurrency ??
      config?.detectedCurrency ??
      'USD';
    const flags = buildFlags(this.cartState);
    const vars  = buildVars(this.cartState, flags, this.itemCount, currency);

    updateStateClasses(this.element, flags);

    if (this.customTemplate) {
      renderCustom(this.element, this.customTemplate, vars, this.summary, msg => this.logger.warn(msg));
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
