/**
 * Offer Display Enhancer
 * Displays offer benefits, conditions, and pricing information
 *
 * This enhancer shows offer details like "Save 55% OFF", benefit descriptions,
 * conditions, and formatted pricing with discounts.
 *
 * @example
 * <div data-next-offer-display
 *      data-next-offer-id="123"
 *      data-next-show-benefit="true"
 *      data-next-show-condition="true">
 *
 *   <div data-offer-name></div>
 *   <div data-offer-benefit-description></div>
 *   <div data-offer-benefit-value></div>
 *   <div data-offer-condition-description></div>
 *   <div data-offer-savings-percent></div>
 *   <div data-offer-savings-amount></div>
 * </div>
 *
 * Attributes:
 * - data-next-offer-display: Main identifier
 * - data-next-offer-id: Offer ID from campaign data
 * - data-next-show-benefit: Show benefit information (default: true)
 * - data-next-show-condition: Show condition information (default: true)
 * - data-next-format: Format type (percentage, currency, text)
 *
 * Display Elements:
 * - [data-offer-name] - Offer name
 * - [data-offer-benefit-description] - Benefit description
 * - [data-offer-benefit-value] - Benefit value (formatted)
 * - [data-offer-benefit-type] - Benefit type
 * - [data-offer-condition-description] - Condition description
 * - [data-offer-condition-value] - Condition value
 * - [data-offer-condition-type] - Condition type
 * - [data-offer-savings-percent] - Savings as percentage
 * - [data-offer-savings-amount] - Savings as currency
 * - [data-offer-code] - Offer code (for vouchers)
 */

import { BaseEnhancer } from '@/enhancers/base/BaseEnhancer';
import { useCampaignStore } from '@/stores/campaignStore';
import { useCartStore } from '@/stores/cartStore';
import { DisplayFormatter } from '@/enhancers/display/DisplayEnhancerCore';
import type { Offer, OfferBenefit, OfferCondition } from '@/types/campaign';
import type { CartState } from '@/types/global';

export class OfferDisplayEnhancer extends BaseEnhancer {
  private offerId?: number;
  private offerData?: Offer;
  private showBenefit: boolean = true;
  private showCondition: boolean = true;
  private displayElements: Map<string, HTMLElement[]> = new Map();

  public async initialize(): Promise<void> {
    this.validateElement();

    // Get configuration
    const offerIdAttr = this.getAttribute('data-next-offer-id');
    this.offerId = offerIdAttr ? parseInt(offerIdAttr, 10) : undefined;

    this.showBenefit = this.getAttribute('data-next-show-benefit') !== 'false';
    this.showCondition = this.getAttribute('data-next-show-condition') !== 'false';

    // Load offer data
    if (this.offerId) {
      await this.loadOfferData();
    }

    // Find all display elements
    this.findDisplayElements();

    // Subscribe to cart changes to update dynamic values
    this.subscribe(useCartStore, this.handleCartUpdate.bind(this));

    // Initial render
    this.renderOfferData();

    this.logger.debug('OfferDisplayEnhancer initialized:', {
      offerId: this.offerId,
      hasOfferData: !!this.offerData
    });
  }

  private async loadOfferData(): Promise<void> {
    try {
      const campaignStore = useCampaignStore.getState();
      const campaign = campaignStore.campaign;

      if (campaign?.offers && this.offerId) {
        this.offerData = campaign.offers.find(offer => offer.ref_id === this.offerId);

        if (this.offerData) {
          this.logger.debug('Loaded offer data:', this.offerData);
        } else {
          this.logger.warn(`Offer ${this.offerId} not found in campaign data`);
        }
      }
    } catch (error) {
      this.logger.error('Failed to load offer data:', error);
    }
  }

  private findDisplayElements(): void {
    const selectors = [
      'data-offer-name',
      'data-offer-benefit-description',
      'data-offer-benefit-value',
      'data-offer-benefit-type',
      'data-offer-condition-description',
      'data-offer-condition-value',
      'data-offer-condition-type',
      'data-offer-savings-percent',
      'data-offer-savings-amount',
      'data-offer-code',
      'data-offer-type'
    ];

    selectors.forEach(selector => {
      const elements = this.element.querySelectorAll(`[${selector}]`);
      if (elements.length > 0) {
        this.displayElements.set(selector, Array.from(elements) as HTMLElement[]);
      }
    });

    this.logger.debug('Found display elements:', {
      count: this.displayElements.size,
      selectors: Array.from(this.displayElements.keys())
    });
  }

  private renderOfferData(): void {
    if (!this.offerData) {
      this.logger.debug('No offer data to render');
      return;
    }

    // Render offer name
    this.updateElements('data-offer-name', this.offerData.name);

    // Render offer type
    this.updateElements('data-offer-type', this.offerData.type);

    // Render offer code (for vouchers)
    if (this.offerData.code) {
      this.updateElements('data-offer-code', this.offerData.code);
    }

    // Render benefit
    if (this.showBenefit && this.offerData.benefit) {
      this.renderBenefit(this.offerData.benefit);
    }

    // Render condition
    if (this.showCondition && this.offerData.condition) {
      this.renderCondition(this.offerData.condition);
    }

    // Calculate and render savings
    this.renderSavings();

    // Add CSS class based on offer type
    this.element.classList.add(`next-offer-${this.offerData.type}`);
    this.element.setAttribute('data-offer-loaded', 'true');
  }

  private renderBenefit(benefit: OfferBenefit): void {
    // Benefit description
    this.updateElements('data-offer-benefit-description', benefit.description);

    // Benefit type
    this.updateElements('data-offer-benefit-type', benefit.type);

    // Benefit value (formatted based on type)
    const formattedValue = this.formatBenefitValue(benefit);
    this.updateElements('data-offer-benefit-value', formattedValue);

    this.logger.debug('Rendered benefit:', {
      type: benefit.type,
      value: formattedValue
    });
  }

  private renderCondition(condition: OfferCondition): void {
    // Condition description
    this.updateElements('data-offer-condition-description', condition.description);

    // Condition type
    this.updateElements('data-offer-condition-type', condition.type);

    // Condition value
    const formattedValue = this.formatConditionValue(condition);
    this.updateElements('data-offer-condition-value', formattedValue);

    this.logger.debug('Rendered condition:', {
      type: condition.type,
      value: formattedValue
    });
  }

  private renderSavings(): void {
    if (!this.offerData || !this.offerData.benefit) return;

    const benefit = this.offerData.benefit;

    // For percentage benefits, show the percentage
    if (benefit.type === 'package_percentage' ||
        benefit.type === 'shipping_percentage' ||
        benefit.type === 'order_percentage') {

      const percentValue = parseFloat(benefit.value);
      const formattedPercent = `${percentValue}%`;

      this.updateElements('data-offer-savings-percent', formattedPercent);

      // Also update with "Save X% OFF" format
      this.updateElements('data-offer-savings-formatted', `Save ${formattedPercent} OFF`);
    }

    // Calculate actual savings amount from cart if available
    this.calculateAndRenderCartSavings();
  }

  private calculateAndRenderCartSavings(): void {
    const cartStore = useCartStore.getState();

    if (!cartStore.discountDetails || !this.offerData) return;

    // Find this offer's discount in cart
    const offerDiscount = cartStore.discountDetails.offerDiscounts?.find(
      discount => discount.offer_id === this.offerId
    );

    if (offerDiscount) {
      const savingsAmount = parseFloat(offerDiscount.amount);
      const formattedAmount = DisplayFormatter.formatCurrency(savingsAmount);

      this.updateElements('data-offer-savings-amount', formattedAmount);

      this.logger.debug('Rendered cart savings:', {
        offerId: this.offerId,
        amount: formattedAmount
      });
    }
  }

  private formatBenefitValue(benefit: OfferBenefit): string {
    const value = parseFloat(benefit.value);

    switch (benefit.type) {
      case 'package_percentage':
      case 'shipping_percentage':
      case 'order_percentage':
        return `${value}%`;

      default:
        return benefit.value;
    }
  }

  private formatConditionValue(condition: OfferCondition): string {
    switch (condition.type) {
      case 'count':
        return condition.value.toString();

      case 'any':
        return 'Any';

      default:
        return condition.value.toString();
    }
  }

  private updateElements(selector: string, value: string): void {
    const elements = this.displayElements.get(selector);

    if (!elements || elements.length === 0) return;

    elements.forEach(element => {
      // Check if element has a format attribute
      const format = element.getAttribute('data-format');

      let displayValue = value;

      // Apply formatting if specified
      if (format) {
        displayValue = this.applyFormat(value, format);
      }

      // Update element
      if (element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement) {
        element.value = displayValue;
      } else {
        element.textContent = displayValue;
      }

      // Also set as data attribute for CSS targeting
      element.setAttribute('data-value', displayValue);
    });
  }

  private applyFormat(value: string, format: string): string {
    switch (format) {
      case 'uppercase':
        return value.toUpperCase();

      case 'lowercase':
        return value.toLowerCase();

      case 'currency':
        const numValue = parseFloat(value);
        return isNaN(numValue) ? value : DisplayFormatter.formatCurrency(numValue);

      case 'percentage':
        const percentValue = parseFloat(value);
        return isNaN(percentValue) ? value : `${percentValue}%`;

      default:
        return value;
    }
  }

  private handleCartUpdate(cartState: CartState): void {
    // Update dynamic values when cart changes
    this.calculateAndRenderCartSavings();
  }

  public update(): void {
    this.renderOfferData();
  }

  public async refreshOfferData(): Promise<void> {
    await this.loadOfferData();
    this.renderOfferData();
  }

  public getOfferData(): Offer | undefined {
    return this.offerData;
  }

  public override destroy(): void {
    this.displayElements.clear();

    if (this.offerData) {
      this.element.classList.remove(`next-offer-${this.offerData.type}`);
    }

    super.destroy();
  }
}
