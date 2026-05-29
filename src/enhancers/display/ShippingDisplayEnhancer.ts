/**
 * Shipping Display Enhancer
 * Displays shipping data based on data-next-shipping-id context
 */

import { BaseDisplayEnhancer, DisplayFormatter } from './DisplayEnhancerCore';
import { getPropertyMapping } from './DisplayEnhancerTypes';
import { useCampaignStore } from '@/stores/campaignStore';
// import { useCartStore } from '@/stores/cartStore'; - removed unused import
import type { ShippingOption } from '@/types/api';

/**
 * Renders a value from a campaign shipping method into an element.
 *
 * Activated by `data-next-display="shipping.*"`, routed here by `AttributeScanner`.
 * It resolves which shipping method to read by walking up to the nearest ancestor
 * carrying `data-next-shipping-id` and matching that id against
 * `useCampaignStore().data.shipping_methods` (by `ref_id`). It subscribes to the
 * campaign store and re-renders through the `BaseDisplayEnhancer` pipeline when
 * shipping data changes.
 *
 * The property after `shipping.` selects what to show: `price` / `cost` (formatted
 * currency) and `price.raw` / `cost.raw` (numeric), `isFree` (true when price is
 * zero), `name` / `code`, `id` / `refId`, and `method` (the full object). If no
 * `data-next-shipping-id` context is found the enhancer logs a warning and does
 * not render.
 *
 * ## Attributes
 *
 * | Attribute | Type | Required | Default | Description |
 * |---|---|---|---|---|
 * | `data-next-display` | `string` | yes | — | Shipping property path, e.g. `shipping.price` or `shipping.isFree`. |
 * | `data-next-format` / `data-format` | `"currency" \| "number" \| "boolean" \| "date" \| "percentage" \| "auto"` | no | auto-detected | Forces value formatting. |
 * | `data-hide-if-zero` | `"true" \| "false"` | no | `false` | Hides the element when the value is zero. |
 * | `data-hide-if-false` | `"true" \| "false"` | no | `false` | Hides the element when the value is falsy. |
 * | `data-hide-zero-cents` | `"true" \| "false"` | no | `false` | Drops `.00` cents from formatted currency. |
 * | `data-divide-by` | `number` | no | — | Divides a numeric value before formatting. |
 * | `data-multiply-by` | `number` | no | — | Multiplies a numeric value before formatting. |
 *
 * Note: the shipping method is identified by a `data-next-shipping-id` ancestor,
 * not by an attribute on this element.
 *
 * @example
 * ```html
 * <div data-next-shipping-id="3">
 *   <span data-next-display="shipping.price"></span>
 * </div>
 * ```
 */
export class ShippingDisplayEnhancer extends BaseDisplayEnhancer {
  private shippingId?: number;
  private shippingMethod?: ShippingOption;

  override async initialize(): Promise<void> {
    this.validateElement();
    this.parseDisplayAttributes();
    
    // Find shipping context
    this.detectShippingContext();
    
    if (!this.shippingId) {
      this.logger.warn('ShippingDisplayEnhancer requires data-next-shipping-id context');
      return;
    }
    
    this.setupStoreSubscriptions();
    await this.performInitialUpdate();
    
    this.logger.debug(`ShippingDisplayEnhancer initialized with shipping ID ${this.shippingId}`);
  }

  protected setupStoreSubscriptions(): void {
    // Subscribe to campaign store for shipping methods
    this.subscribe(useCampaignStore, this.handleCampaignUpdate.bind(this));
    
    // Get initial shipping method
    this.loadShippingMethod();
  }

  private handleCampaignUpdate(): void {
    this.loadShippingMethod();
    this.updateDisplay();
  }

  private detectShippingContext(): void {
    // Find the closest parent element with data-next-shipping-id
    const shippingElement = this.element.closest('[data-next-shipping-id]') as HTMLElement;
    
    if (!shippingElement) {
      return;
    }
    
    const shippingIdStr = shippingElement.getAttribute('data-next-shipping-id');
    if (shippingIdStr) {
      this.shippingId = parseInt(shippingIdStr, 10);
    }
  }

  private loadShippingMethod(): void {
    if (!this.shippingId) return;
    
    const campaignStore = useCampaignStore.getState();
    const shippingMethods = campaignStore.data?.shipping_methods || [];
    
    const method = shippingMethods.find(
      method => method.ref_id === this.shippingId
    );
    if (method) {
      this.shippingMethod = method;
    }
    
    if (!this.shippingMethod) {
      this.logger.warn(`Shipping method ${this.shippingId} not found in campaign data`);
    }
  }

  protected getPropertyValue(): any {
    if (!this.shippingMethod || !this.property) return undefined;

    // Handle calculated properties
    const mappedPath = getPropertyMapping('shipping', this.property);
    if (mappedPath && mappedPath.startsWith('_calculated.')) {
      const calculatedProp = mappedPath.replace('_calculated.', '');
      return this.getCalculatedProperty(calculatedProp);
    }

    // Direct property access
    switch (this.property) {
      case 'isFree':
        return parseFloat(this.shippingMethod.price || '0') === 0;
      
      case 'cost':
      case 'price':
        return DisplayFormatter.formatValue(parseFloat(this.shippingMethod.price || '0'), 'currency');
      
      case 'cost.raw':
      case 'price.raw':
        return parseFloat(this.shippingMethod.price || '0');
      
      case 'name':
      case 'code':
        return this.shippingMethod.code;
      
      case 'id':
      case 'refId':
        return this.shippingMethod.ref_id;
      
      case 'method':
        return this.shippingMethod;
      
      default:
        return undefined;
    }
  }

  private getCalculatedProperty(property: string): any {
    if (!this.shippingMethod) return undefined;

    switch (property) {
      case 'isFree':
        return parseFloat(this.shippingMethod.price || '0') === 0;
      
      case 'cost':
      case 'price':
        return DisplayFormatter.formatValue(parseFloat(this.shippingMethod.price || '0'), 'currency');
      
      case 'name':
      case 'code':
        return this.shippingMethod.code;
      
      case 'id':
      case 'refId':
        return this.shippingMethod.ref_id;
      
      case 'method':
        return this.shippingMethod;
      
      default:
        return undefined;
    }
  }

  public override update(): void {
    this.updateDisplay();
  }
}