/**
 * Cart Summary Enhancer
 * Displays cart summary data fetched from the API's calculate endpoint.
 *
 * Scalar display (renders a single value as text content):
 *   data-next-cart-summary="total"
 *   data-next-cart-summary="total_discount"
 *   data-next-cart-summary="shipping"
 *   data-next-cart-summary="shipping_discount"
 *
 * List display (renders a list using a template):
 *   data-next-cart-summary="offer_discounts"
 *   data-next-cart-summary="voucher_discounts"
 *
 *   Template source (first match wins):
 *     <template> child element            — native HTML template inside the container
 *     data-next-template-id="<id>"       — innerHTML of element with that id
 *     data-next-template="<html string>" — inline template attribute
 *
 *   Template variables:
 *     {discount.name}             — discount name
 *     {discount.amount}           — raw amount string from API (e.g. "5.00")
 *     {discount.description}      — discount description
 *
 * CSS classes managed on the host element:
 *   next-summary-empty            — added when the list/value is empty or zero
 *   next-summary-has-items        — added when the list has at least one item
 *
 * @example Scalar values
 * <p>Total: <span data-next-cart-summary="total"></span></p>
 * <p>Discount: <span data-next-cart-summary="total_discount"></span></p>
 * <p>Shipping: <span data-next-cart-summary="shipping"></span></p>
 * <p>Shipping discount: <span data-next-cart-summary="shipping_discount"></span></p>
 *
 * @example Offer discounts list — <template> child (recommended)
 * <ul data-next-cart-summary="offer_discounts">
 *   <template>
 *     <li>
 *       <strong>{discount.name}</strong>
 *       <span>{discount.description}</span>
 *       <span>-{discount.amount}</span>
 *     </li>
 *   </template>
 * </ul>
 *
 * @example Voucher discounts list — external <template> by ID
 * <ul data-next-cart-summary="voucher_discounts"
 *     data-next-template-id="voucher-tpl">
 * </ul>
 * <template id="voucher-tpl">
 *   <li>{discount.name}: -{discount.amount}</li>
 * </template>
 *
 * @example Conditional visibility (hide section when no discounts)
 * <div data-next-show="cart.summary.hasOfferDiscounts">
 *   <p>Applied offers:</p>
 *   <ul data-next-cart-summary="offer_discounts">
 *     <template>
 *       <li>{discount.name} — -{discount.amount}</li>
 *     </template>
 *   </ul>
 * </div>
 */

import { BaseEnhancer } from '@/enhancers/base/BaseEnhancer';
import { useCartStore } from '@/stores/cartStore';
import { formatCurrency } from '@/utils/currencyFormatter';
import type { CartState } from '@/types/global';
import type { CartSummary } from '@/types/api';

type ScalarProperty = 'total' | 'total_discount' | 'shipping' | 'shipping_discount';
type ListProperty = 'offer_discounts' | 'voucher_discounts';
type SummaryProperty = ScalarProperty | ListProperty;

const LIST_PROPERTIES: ReadonlySet<string> = new Set<ListProperty>(['offer_discounts', 'voucher_discounts']);

export class CartSummaryEnhancer extends BaseEnhancer {
  private property!: SummaryProperty;
  private template?: string;
  private summary?: CartSummary;

  public async initialize(): Promise<void> {
    this.validateElement();

    const prop = this.getAttribute('data-next-cart-summary');
    if (!prop) {
      this.logger.warn('data-next-cart-summary attribute is missing or empty');
      return;
    }
    this.property = prop as SummaryProperty;

    if (this.isListProperty()) {
      this.template = this.resolveTemplate();
    }

    this.subscribe(useCartStore, this.handleCartUpdate.bind(this));
    this.summary = useCartStore.getState().summary;
    this.render();

    this.logger.debug('CartSummaryEnhancer initialized', { property: this.property });
  }

  private handleCartUpdate(state: CartState): void {
    if (state.summary !== this.summary) {
      this.summary = state.summary;
      this.render();
    }
  }

  private resolveTemplate(): string | undefined {
    // 1. Native <template> child element
    const templateEl = this.element.querySelector(':scope > template');
    if (templateEl) {
      return (templateEl as HTMLTemplateElement).innerHTML.trim();
    }

    // 2. External element by ID
    const templateId = this.getAttribute('data-next-template-id');
    if (templateId) {
      const el = document.getElementById(templateId);
      return el?.innerHTML.trim();
    }

    // 3. Inline attribute
    return this.getAttribute('data-next-template') ?? undefined;
  }

  private isListProperty(): boolean {
    return LIST_PROPERTIES.has(this.property);
  }

  private render(): void {
    if (!this.summary) return;

    if (this.isListProperty()) {
      this.renderList();
    } else {
      this.renderScalar();
    }
  }

  private renderScalar(): void {
    if (!this.summary) return;

    const value = this.summary[this.property as ScalarProperty];
    const isEmpty = !value || parseFloat(value as string) === 0;

    this.toggleClass('next-summary-empty', isEmpty);
    this.toggleClass('next-summary-has-items', !isEmpty);

    const numeric = parseFloat(value as string);
    this.element.textContent = isNaN(numeric) ? (value as string ?? '') : formatCurrency(numeric);
  }

  private renderList(): void {
    if (!this.summary) return;

    const items = this.summary[this.property as ListProperty] ?? [];
    const isEmpty = items.length === 0;

    this.toggleClass('next-summary-empty', isEmpty);
    this.toggleClass('next-summary-has-items', !isEmpty);

    if (!this.template) {
      this.logger.debug('No template defined for list property, skipping render', { property: this.property });
      return;
    }

    // Remove previously rendered items but keep any <template> children intact
    Array.from(this.element.childNodes).forEach(node => {
      if ((node as Element).tagName?.toLowerCase() !== 'template') {
        node.parentNode?.removeChild(node);
      }
    });

    this.element.insertAdjacentHTML('beforeend', items.map(d => this.renderItem(d)).join(''));
  }

  private renderItem(discount: { name?: string; amount: string; description?: string }): string {
    return this.template!.replace(/\{([^}]+)\}/g, (_, key: string) => {
      switch (key) {
        case 'discount.name':        return discount.name ?? '';
        case 'discount.amount':      return discount.amount ?? '';
        case 'discount.description': return discount.description ?? '';
        default:                     return '';
      }
    });
  }

  public update(): void {
    this.render();
  }
}
