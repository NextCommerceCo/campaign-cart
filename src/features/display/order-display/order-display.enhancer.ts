/**
 * Order Display Enhancer
 * Displays order data using the unified data-next-display="order.xxx" pattern
 */

import { BaseDisplayEnhancer } from '@/core/base/base-display-enhancer';
import { useOrderStore } from '@/state/order';
import { getApiClient } from '@/client';
import type { IApiClient } from '@/api/client.types';
import { getDisplayValue } from './order-display.properties';

export class OrderDisplayEnhancer extends BaseDisplayEnhancer {
  private apiClient?: IApiClient;
  private orderState: any = {};

  public override async initialize(): Promise<void> {
    // Check for ref_id in URL and auto-load order BEFORE parent initialization
    await this.checkAndLoadOrderFromUrl();

    // Call parent initialization which handles display attributes and store subscriptions
    await super.initialize();
  }

  protected setupStoreSubscriptions(): void {
    // Subscribe to order store changes
    this.subscribe(useOrderStore, this.handleOrderUpdate.bind(this));

    // Initial state
    this.orderState = useOrderStore.getState();
  }

  protected getPropertyValue(): any {
    return getDisplayValue(this.orderState, this.displayPath!, this.logger);
  }

  public override update(data?: any): void {
    if (data) {
      this.handleOrderUpdate(data);
    } else {
      super.update();
    }
  }

  private async checkAndLoadOrderFromUrl(): Promise<void> {
    const urlParams = new URLSearchParams(window.location.search);
    // Check for both ref_id and order_ref_id parameters
    const refId = urlParams.get('ref_id') || urlParams.get('order_ref_id');

    if (refId) {
      const orderStore = useOrderStore.getState();

      // Only load if not already loaded or loading
      if (
        !orderStore.order &&
        !orderStore.isLoading &&
        orderStore.refId !== refId
      ) {
        try {
          this.apiClient = getApiClient();

          await orderStore.loadOrder(refId, this.apiClient);
        } catch (error) {
          this.logger.error('Failed to auto-load order:', error);
        }
      }
    }
  }

  private handleOrderUpdate(orderState: any): void {
    try {
      // Update internal state
      this.orderState = orderState;

      // Update loading state classes
      if (orderState.isLoading) {
        this.addClass('next-loading');
        this.removeClass('next-loaded');
        this.removeClass('next-error');
      } else if (orderState.error) {
        this.removeClass('next-loading');
        this.removeClass('next-loaded');
        this.addClass('next-error');
      } else if (orderState.order) {
        this.removeClass('next-loading');
        this.addClass('next-loaded');
        this.removeClass('next-error');
      }

      // Trigger display update through parent class
      this.updateDisplay();
    } catch (error) {
      this.handleError(error, 'handleOrderUpdate');
      this.updateElementContent('N/A');
      this.addClass('next-error');
    }
  }

  protected override updateElementContent(value: string): void {
    // Special handling for order status URL links
    if (
      this.element.tagName === 'A' &&
      this.displayPath?.includes('statusUrl')
    ) {
      (this.element as HTMLAnchorElement).href = value;
      if (!this.element.textContent) {
        this.element.textContent = 'View Order Status';
      }
    } else {
      // Use parent implementation for standard cases
      super.updateElementContent(value);
    }
  }
}
