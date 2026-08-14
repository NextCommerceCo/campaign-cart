/**
 * Test Order Manager - Handles test data population and test order creation
 */

import type { Logger } from '@/core/logger';
import { useCheckoutStore } from '@/state/checkout';

export class TestOrderManager {
  constructor(private logger: Logger) {}

  public handleTestDataFilled(
    fields: Map<string, HTMLElement>
  ): void {
    this.logger.debug('Test data filled event received, updating form fields');
    
    // Small delay to ensure store has been updated
    setTimeout(() => {
      // Also trigger change events on form fields to ensure validation updates
      fields.forEach((field) => {
        if (field instanceof HTMLInputElement || field instanceof HTMLSelectElement) {
          field.dispatchEvent(new Event('change', { bubbles: true }));
        }
      });
      
      this.logger.debug('Form fields updated with test data');
    }, 150);
  }

  public async handleKonamiActivation(
    event: Event,
    createTestOrderCallback: () => Promise<any>,
    handleOrderRedirectCallback: (order: any) => void,
    updateFormDataCallback: (data: Record<string, any>) => void,
    setPaymentMethodCallback: (method: string) => void,
    setPaymentTokenCallback: (token: string) => void,
    setSameAsShippingCallback: (same: boolean) => void,
    setShippingMethodCallback: (method: any) => void,
    clearAllErrorsCallback: () => void,
    populateFormDataCallback: () => void,
    isCartEmptyCallback: () => boolean
  ): Promise<void> {
    this.logger.debug('Konami code activated, creating test order');
    
    const customEvent = event as CustomEvent;
    const activationMethod = customEvent.detail?.method;
    
    if (activationMethod === 'konami') {
      // Fill the form with test data
      await this.fillTestDataAndCreateOrder(
        createTestOrderCallback,
        handleOrderRedirectCallback,
        updateFormDataCallback,
        setPaymentMethodCallback,
        setPaymentTokenCallback,
        setSameAsShippingCallback,
        setShippingMethodCallback,
        clearAllErrorsCallback,
        populateFormDataCallback,
        isCartEmptyCallback
      );
    }
  }

  private async fillTestDataAndCreateOrder(
    createTestOrderCallback: () => Promise<any>,
    handleOrderRedirectCallback: (order: any) => void,
    updateFormDataCallback: (data: Record<string, any>) => void,
    setPaymentMethodCallback: (method: string) => void,
    setPaymentTokenCallback: (token: string) => void,
    setSameAsShippingCallback: (same: boolean) => void,
    setShippingMethodCallback: (method: any) => void,
    clearAllErrorsCallback: () => void,
    populateFormDataCallback: () => void,
    isCartEmptyCallback: () => boolean
  ): Promise<void> {
    try {
      // Don't show duplicate Konami popup - TestModeManager already shows one with progress bar
      // this.konamiHandler.showKonamiActivationMessage();
      
      // Fill test data (same as debug panel)
      const testFormData = {
        email: 'test@test.com',
        fname: 'Test',
        lname: 'Order',
        phone: '+14807581224',
        address1: 'Test Address 123',
        address2: '',
        city: 'Tempe',
        province: 'AZ',
        postal: '85281',
        country: 'US',
        accepts_marketing: true
      };
      
      // Clear any existing errors
      clearAllErrorsCallback();
      
      // Fill the form data
      updateFormDataCallback(testFormData);
      
      // Set payment method to credit card with test token
      setPaymentMethodCallback('card_token');
      setPaymentTokenCallback('test_card'); // Use test card token
      setSameAsShippingCallback(true);
      
      // Use existing shipping method from cart/checkout store if available
      // Otherwise, try to find the first available shipping method from campaign
      const { useCartStore } = await import('@/state/cart');
      const { useCampaignStore } = await import('@/state/campaign');
      
      const cartStore = useCartStore.getState();
      const checkoutStore = useCheckoutStore.getState();
      const campaignStore = useCampaignStore.getState();
      
      let shippingMethod = cartStore.shippingMethod || checkoutStore.shippingMethod;
      
      // If no shipping method is selected, use the first available one from campaign
      if (!shippingMethod && campaignStore.data?.shipping_methods && campaignStore.data.shipping_methods.length > 0) {
        const firstMethod = campaignStore.data.shipping_methods[0];
        if (firstMethod) {
          shippingMethod = {
            id: firstMethod.ref_id,
            name: firstMethod.code,
            price: parseFloat(firstMethod.price || '0'),
            code: firstMethod.code
          };
        }
        this.logger.debug('No shipping method selected, using first available:', shippingMethod);
      }
      
      // Only set shipping method if we have one
      if (shippingMethod) {
        setShippingMethodCallback(shippingMethod);
      } else {
        this.logger.warn('No shipping methods available for test order');
      }
      
      // Update form fields
      populateFormDataCallback();
      
      // Ensure cart has items (if empty, the createOrder will handle it)
      if (isCartEmptyCallback()) {
        this.logger.debug('Cart is empty for test order, createOrder will handle minimal data');
      }
      
      this.logger.info('Creating test order with Konami code data...');
      
      // Small delay to ensure all state is updated, then create order
      setTimeout(async () => {
        try {
          // Create the test order
          const order = await createTestOrderCallback();

          // No event for a created order — `order:completed` is emitted by the
          // order store on the landing page, once the order is fetched back paid.

          // Handle redirect
          handleOrderRedirectCallback(order);
          
        } catch (error) {
          this.logger.error('Failed to create test order:', error);
          this.showTestOrderError(error);
        }
      }, 1000);
      
    } catch (error) {
      this.logger.error('Error filling test data for Konami order:', error);
    }
  }

  private showTestOrderError(error: any): void {
    const errorElement = document.createElement('div');
    errorElement.style.cssText = `
      position: fixed;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      background: #ff4444;
      color: white;
      padding: 20px;
      border-radius: 10px;
      z-index: 10001;
      text-align: center;
      font-family: Arial, sans-serif;
      box-shadow: 0 10px 20px rgba(0,0,0,0.3);
    `;
    
    errorElement.innerHTML = `
      <h3 style="margin: 0 0 10px 0;">❌ Test Order Failed</h3>
      <p style="margin: 0 0 10px 0;">Error creating test order:</p>
      <div style="font-size: 12px; opacity: 0.9;">${error.message || 'Unknown error'}</div>
    `;
    
    document.body.appendChild(errorElement);
    
    // Remove error after 5 seconds
    setTimeout(() => {
      if (errorElement.parentNode) {
        errorElement.parentNode.removeChild(errorElement);
      }
    }, 5000);
  }
}