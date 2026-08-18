/**
 * Express Checkout Processor - Handles PayPal, Apple Pay, Google Pay
 */

import { EXPRESS_PAYMENT_METHOD_MAP } from '../constants/field-mappings';
import type { Logger } from '@/core/logger';
import type { OrderManager } from '../managers/order-manager';
import type { CartItem } from '@/types/global';
import { nextAnalytics, EcommerceEvents } from '@/core/analytics/index';
import { paymentMethodLabel } from '@/utils/payment-method';
import {
  resolvePaymentErrorTarget,
  showPaymentErrorTarget,
} from '../utils/payment-error-container';

export class ExpressCheckoutProcessor {
  constructor(
    private logger: Logger,
    private showLoadingCallback: () => void,
    private hideLoadingCallback: (immediate?: boolean) => void,
    private emitCallback: (event: string, data: any) => void,
    private orderManager: OrderManager
  ) {}

  public async handleExpressCheckout(
    method: string,
    cartItems: CartItem[],
    isCartEmpty: boolean,
    _resetCart: () => void
  ): Promise<void> {
    let hasError = false;

    try {
      this.showLoadingCallback();

      // Validate cart is not empty
      if (isCartEmpty) {
        this.logger.warn('Cannot checkout with empty cart');
        this.emitCallback('express-checkout:error', {
          method: method,
          error: 'Cart is empty',
        });
        hasError = true;
        return;
      }

      // Get mapped payment method
      const paymentMethod = EXPRESS_PAYMENT_METHOD_MAP[method] || method;

      // NOTE: begin_checkout is already tracked when the checkout page loads (in CheckoutFormEnhancer)
      // We should NOT track it again here - that would be a duplicate

      // Track add_payment_info event immediately for express methods
      try {
        const paymentType = paymentMethodLabel(paymentMethod);
        nextAnalytics.track(
          EcommerceEvents.createAddPaymentInfoEvent(paymentType)
        );
        this.logger.info(
          'Tracked add_payment_info event for express checkout',
          { paymentType }
        );
      } catch (analyticsError) {
        this.logger.warn(
          'Failed to track add_payment_info event:',
          analyticsError
        );
      }

      // Emit express checkout started event
      this.emitCallback('express-checkout:started', {
        method: paymentMethod,
        itemCount: cartItems.length,
      });

      this.logger.info(`Express checkout initiated with ${method}`);

      // Create express order using OrderManager - just hit the API with the payment method
      const order = await this.orderManager.createExpressOrder(
        cartItems,
        paymentMethod as any
      );

      // Emit success event
      this.emitCallback('express-checkout:completed', {
        method: paymentMethod,
        order: order,
      });

      // Handle redirect using OrderManager
      this.orderManager.handleOrderRedirect(order);
    } catch (error: any) {
      hasError = true;
      this.logger.error('Express checkout failed:', error);

      // Check for payment-specific errors and display them
      if (error.responseData) {
        const responseData = error.responseData;

        // Handle PayPal-specific errors
        if (method === 'paypal' && responseData.payment_details) {
          this.displayPayPalError(responseData.payment_details);
        }
        // Every other express method — Apple Pay, Google Pay, Link, and whatever
        // is added next. It used to name the two it knew and would have called a
        // Link failure a Google Pay one.
        else if (responseData.payment_details) {
          this.displayExpressPaymentError(method, responseData.payment_details);
        }
      }

      this.emitCallback('express-checkout:failed', {
        method: method,
        error: error instanceof Error ? error.message : 'Unknown error',
      });

      throw error;
    } finally {
      // Hide immediately on error, with delay on success
      this.hideLoadingCallback(hasError);
    }
  }

  /**
   * PayPal is the one method whose message is worded for it: the shopper is
   * standing in front of a PayPal button, not a form, so "try a different
   * payment method" is the only useful next step.
   */
  private displayPayPalError(errorMessage: string): void {
    this.displayGeneralPaymentError(
      errorMessage + ' Please try a different payment method.',
      'paypal'
    );
  }

  private displayExpressPaymentError(
    method: string,
    errorMessage: string
  ): void {
    this.displayGeneralPaymentError(
      `${paymentMethodLabel(method)} error: ${errorMessage}. Please try a different payment method.`,
      method
    );
  }

  /**
   * Writes into the failing method's own container, falling back to the page's
   * shared one — the same rule the checkout form and the card tokenizer follow,
   * because all three share
   * [`payment-error-container.ts`](../utils/payment-error-container.ts).
   *
   * This used to hold its own `paypal-error` and `credit-error` lookups, which is
   * why a PayPal decline was written into both containers at once and every other
   * express method was written into the card's.
   */
  private displayGeneralPaymentError(message: string, method?: string): void {
    const target = resolvePaymentErrorTarget(method, this.logger);
    if (!target) {
      this.logger.error(
        'Express checkout failed and the page has no payment error container to say so in',
        { method, message }
      );
      return;
    }

    target.text.textContent = message;
    showPaymentErrorTarget(target);
    this.logger.info('Express payment error displayed', { method, message });
  }
}
