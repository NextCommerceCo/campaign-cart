/**
 * Discount List Enhancer
 * Displays cart-level and item-level discounts with descriptions and amounts
 *
 * This enhancer shows offer discounts and voucher discounts applied to the cart.
 * It can display both order-level discounts (from cart.discountDetails) and
 * item-level discounts (from individual cart items).
 *
 * @example
 * <div data-next-discount-list
 *      data-discount-template-id="discount-template"
 *      data-empty-template="<p>No discounts applied</p>"
 *      data-show-item-discounts="true">
 * </div>
 *
 * Attributes:
 * - data-next-discount-list: Main identifier for the enhancer
 * - data-discount-template: Template string for discount items (optional)
 * - data-discount-template-id: ID of template element (optional)
 * - data-discount-template-selector: CSS selector for template element (optional)
 * - data-empty-template: Template to show when no discounts (optional)
 * - data-show-item-discounts: Show item-level discounts separately (default: false)
 * - data-group-by-offer: Group discounts by offer ID (default: true)
 *
 * Template Variables:
 * - {discount.name} - Discount name
 * - {discount.description} - Discount description
 * - {discount.amount} - Formatted discount amount
 * - {discount.amount.raw} - Raw discount amount (number)
 * - {discount.offerId} - Offer ID (if applicable)
 * - {discount.type} - Type: 'offer' or 'voucher'
 * - {discount.isItemLevel} - 'true' if item-level discount
 * - {discount.packageId} - Package ID for item-level discounts
 */

import { BaseEnhancer } from '@/enhancers/base/BaseEnhancer';
import { useCartStore } from '@/stores/cartStore';
import { TemplateRenderer, TemplateFormatters } from '@/shared/utils/TemplateRenderer';
import { DisplayFormatter } from '@/enhancers/display/DisplayEnhancerCore';
import type { CartState } from '@/types/global';

interface DiscountData {
  name: string;
  description: string;
  amount: number;
  formattedAmount: string;
  offerId?: number;
  type: 'offer' | 'voucher';
  isItemLevel: boolean;
  packageId?: number;
}

export class DiscountListEnhancer extends BaseEnhancer {
  private template?: string;
  private emptyTemplate?: string;
  private lastRenderedDiscounts: string = '';
  private showItemDiscounts: boolean = false;
  private groupByOffer: boolean = true;

  public async initialize(): Promise<void> {
    this.validateElement();

    console.log('DiscountListEnhancer initialized');

    // Get template from various sources
    const templateId = this.getAttribute('data-discount-template-id');
    const templateSelector = this.getAttribute('data-discount-template-selector');

    if (templateId) {
      const templateElement = document.getElementById(templateId);
      this.template = templateElement?.innerHTML.trim() ?? '';
    } else if (templateSelector) {
      const templateElement = document.querySelector(templateSelector);
      this.template = templateElement?.innerHTML.trim() ?? '';
    } else {
      this.template = this.getAttribute('data-discount-template') || this.element.innerHTML.trim();
    }

    // If template is empty or just comments, use default template
    if (!this.template || this.template.replace(/<!--[\s\S]*?-->/g, '').trim() === '') {
      this.template = this.getDefaultDiscountTemplate();
    }

    this.emptyTemplate = this.getAttribute('data-empty-template') || '';

    // Configuration options
    this.showItemDiscounts = this.hasAttribute('data-show-item-discounts');
    const groupByOfferAttr = this.getAttribute('data-group-by-offer');
    this.groupByOffer = groupByOfferAttr !== 'false'; // Default to true

    // Subscribe to cart changes
    this.subscribe(useCartStore, this.handleCartUpdate.bind(this));

    // Initial render
    this.handleCartUpdate(useCartStore.getState());

    this.logger.debug('DiscountListEnhancer initialized');
  }

  public update(data?: any): void {
    if (data) {
      this.handleCartUpdate(data);
    }
  }

  private async handleCartUpdate(cartState: CartState): Promise<void> {
    try {
      const discounts = this.collectDiscounts(cartState);

      if (discounts.length === 0) {
        this.renderEmptyState();
      } else {
        await this.renderDiscounts(discounts);
      }
    } catch (error) {
      this.handleError(error, 'handleCartUpdate');
    }
  }

  private renderEmptyState(): void {
    if (this.emptyTemplate) {
      this.element.innerHTML = this.emptyTemplate;
      this.addClass('discount-list-empty');
      this.removeClass('discount-list-has-items');
    } else {
      // If no empty template, just clear the content
      this.element.innerHTML = '';
      this.addClass('discount-list-empty');
      this.removeClass('discount-list-has-items');
    }
  }

  private collectDiscounts(cartState: CartState): DiscountData[] {
    const discounts: DiscountData[] = [];
    const seenOfferIds = new Set<number>();

    // Collect cart-level discounts from discountDetails
    if (cartState.discountDetails) {
      const { offerDiscounts, voucherDiscounts } = cartState.discountDetails;

      // Offer discounts (cart-level)
      if (offerDiscounts && offerDiscounts.length > 0) {
        offerDiscounts.forEach(discount => {
          const amount = parseFloat(discount.amount);
          if (amount > 0) {
            discounts.push({
              name: discount.name || discount.description || `Offer #${discount.offer_id}`,
              description: discount.description || '',
              amount,
              formattedAmount: DisplayFormatter.formatCurrency(amount),
              offerId: discount.offer_id,
              type: 'offer',
              isItemLevel: false,
            });
            seenOfferIds.add(discount.offer_id);
          }
        });
      }

      // Voucher discounts (cart-level)
      if (voucherDiscounts && voucherDiscounts.length > 0) {
        voucherDiscounts.forEach(discount => {
          const amount = parseFloat(discount.amount);
          if (amount > 0) {
            discounts.push({
              name: discount.name || discount.description || 'Voucher Discount',
              description: discount.description || '',
              amount,
              formattedAmount: DisplayFormatter.formatCurrency(amount),
              type: 'voucher',
              isItemLevel: false,
            });
          }
        });
      }
    }

    // Collect item-level discounts if enabled
    if (this.showItemDiscounts && cartState.items) {
      cartState.items.forEach(item => {
        if (item.discounts && item.discounts.length > 0) {
          item.discounts.forEach(discount => {
            const amount = parseFloat(discount.amount);

            // Skip if we've already added this offer at cart level and grouping is enabled
            if (this.groupByOffer && discount.offer_id && seenOfferIds.has(discount.offer_id)) {
              return;
            }

            if (amount > 0) {
              discounts.push({
                name: discount.name || discount.description || `Offer #${discount.offer_id}`,
                description: discount.description || '',
                amount,
                formattedAmount: DisplayFormatter.formatCurrency(amount),
                offerId: discount.offer_id,
                type: 'offer',
                isItemLevel: true,
                packageId: item.packageId,
              });

              if (this.groupByOffer && discount.offer_id) {
                seenOfferIds.add(discount.offer_id);
              }
            }
          });
        }
      });
    }

    return discounts;
  }

  private async renderDiscounts(discounts: DiscountData[]): Promise<void> {
    this.removeClass('discount-list-empty');
    this.addClass('discount-list-has-items');

    const discountsHTML: string[] = [];

    for (const discount of discounts) {
      const discountHTML = await this.renderDiscount(discount);
      if (discountHTML) {
        discountsHTML.push(discountHTML);
      }
    }

    const newHTML = discountsHTML.join('');

    // Only update DOM if content actually changed
    if (newHTML !== this.lastRenderedDiscounts) {
      this.element.innerHTML = newHTML;
      this.lastRenderedDiscounts = newHTML;
    } else {
      this.logger.debug('Discount HTML unchanged, skipping DOM update');
    }
  }

  private async renderDiscount(discount: DiscountData): Promise<string> {
    try {
      // Prepare discount data for template
      const discountData = {
        name: discount.name,
        description: discount.description,
        amount: discount.formattedAmount,
        'amount.raw': discount.amount,
        offerId: discount.offerId ?? '',
        type: discount.type,
        isItemLevel: discount.isItemLevel ? 'true' : 'false',
        packageId: discount.packageId ?? '',

        // Display helpers
        showDescription: discount.description ? 'show' : 'hide',
        showOfferId: discount.offerId ? 'show' : 'hide',
        showPackageId: discount.packageId ? 'show' : 'hide',
        isOffer: discount.type === 'offer' ? 'true' : 'false',
        isVoucher: discount.type === 'voucher' ? 'true' : 'false',
      };

      // Use TemplateRenderer with formatters
      const formatters: TemplateFormatters = {
        ...TemplateRenderer.createDefaultFormatters(),
        currency: (value: any) => DisplayFormatter.formatCurrency(value)
      };

      const template = this.template || this.getDefaultDiscountTemplate();

      return TemplateRenderer.render(template, {
        data: { discount: discountData },
        formatters
      });

    } catch (error) {
      this.logger.error('Error rendering discount:', error);
      return '';
    }
  }

  private getDefaultDiscountTemplate(): string {
    return `
      <div class="discount-item" data-discount-type="{discount.type}" data-offer-id="{discount.offerId}">
        <div class="discount-details">
          <div class="discount-name">{discount.name}</div>
          <div class="discount-description {discount.showDescription}">{discount.description}</div>
        </div>
        <div class="discount-amount">-{discount.amount}</div>
      </div>
    `.trim();
  }

  public getDiscountCount(): number {
    return this.element.querySelectorAll('.discount-item').length;
  }

  public refresh(): void {
    const cartState = useCartStore.getState();
    this.handleCartUpdate(cartState);
  }
}
