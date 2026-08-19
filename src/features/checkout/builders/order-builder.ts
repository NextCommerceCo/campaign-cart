/**
 * Order Builder - Builds order data for API submission
 */

import { toApiPaymentMethod } from '../constants/field-mappings';
import { getSuccessUrl, getFailureUrl } from '../utils/url-utils';
import { useAttributionStore } from '@/state/attribution';
import { useCampaignStore } from '@/state/campaign';
import { useConfigStore } from '@/state/config';
import { useCartStore } from '@/state/cart';
import { useCheckoutStore } from '@/state/checkout';
import { createLogger } from '@/core/logger';
import type { CreateOrder, Address, Payment, Attribution } from '@/types/api';

import { checkPhone } from '../validation/phone-validation';

export class OrderBuilder {
  private logger = createLogger('OrderBuilder');

  /**
   * The phone number to put on the order, in E.164 where that is possible.
   *
   * Every order goes through here, whichever page and whichever payment method built it,
   * which is what makes this the one place the format can actually be guaranteed rather
   * than hoped for. The form normalises as the shopper types, but a number restored from
   * an earlier page, or typed before the phone library finished loading, reaches this
   * point national.
   *
   * The API converts a national number, so a value that could not be normalised is still
   * sent — with a warning naming the country, because a conversion the SDK did not make is
   * one nobody here can see.
   */
  private phoneForApi(
    raw: string | undefined,
    country?: string
  ): string | undefined {
    const check = checkPhone(raw);
    // Absent, not empty: an empty string is a value the API would have to interpret,
    // and `phone_number` is optional. This is also what the old code did by passing
    // `undefined` straight through.
    if (!check.value) return undefined;
    if (check.isE164) return check.value;

    this.logger.warn(
      'Sending a phone number the SDK could not put in E.164 format; the API will have to convert it',
      { country: country ?? 'unknown', reason: check.reason }
    );
    return check.value;
  }

  private getCurrency(): string {
    return (
      useCampaignStore.getState()?.currency ??
      useConfigStore.getState().getCurrency()
    );
  }

  public buildOrder(
    checkoutFormData: Record<string, any>,
    cartItems: any[],
    paymentMethod: string,
    paymentToken?: string,
    billingAddress?: any,
    sameAsShipping: boolean = true,
    shippingMethod?: any,
    vouchers: string[] = []
  ): CreateOrder {
    // Resolved once: the shipping address and the customer record carry the same
    // number, and asking twice would log the same warning twice for one order.
    const shopperPhone = this.phoneForApi(
      checkoutFormData.phone,
      checkoutFormData.country
    );

    // Build shipping address
    const shippingAddress: Address = {
      first_name: checkoutFormData.fname || '',
      last_name: checkoutFormData.lname || '',
      line1: checkoutFormData.address1 || '',
      line2: checkoutFormData.address2,
      line4: checkoutFormData.city || '', // city
      state: checkoutFormData.province,
      postcode: checkoutFormData.postal,
      country: checkoutFormData.country || '',
      phone_number: shopperPhone
    };
    
    // Build billing address
    let billingAddressData: Address | undefined;
    if (!sameAsShipping && billingAddress) {
      billingAddressData = {
        first_name: billingAddress.first_name || '',
        last_name: billingAddress.last_name || '',
        line1: billingAddress.address1 || '',
        line4: billingAddress.city || '',
        country: billingAddress.country || '',
        ...(billingAddress.address2 && { line2: billingAddress.address2 }),
        ...(billingAddress.province && { state: billingAddress.province }),
        ...(billingAddress.postal && { postcode: billingAddress.postal }),
        ...(billingAddress.phone && {
          phone_number: this.phoneForApi(
            billingAddress.phone,
            billingAddress.country
          )
        })
      };
    }
    
    // Build payment details
    const payment: Payment = {
      payment_method: this.mapPaymentMethod(paymentMethod),
      ...(paymentToken && { card_token: paymentToken })
    };
    
    // Get attribution from store
    const attributionStore = useAttributionStore.getState();
    const attribution = attributionStore.getAttributionForApi();
    
    // Build order request
    const orderData: CreateOrder = {
      lines: cartItems.map(item => ({
        package_id: item.packageId,
        quantity: item.quantity,
        is_upsell: item.is_upsell || false,
        ...(item.properties !== undefined && { properties: item.properties }),
      })),
      shipping_address: shippingAddress,
      ...(billingAddressData && { billing_address: billingAddressData }),
      billing_same_as_shipping_address: sameAsShipping,
      shipping_method: shippingMethod?.id || this.getDefaultShippingMethodId(),
      payment_detail: payment,
      user: {
        email: checkoutFormData.email,
        first_name: checkoutFormData.fname || '',
        last_name: checkoutFormData.lname || '',
        language: 'en',
        phone_number: shopperPhone,
        accepts_marketing: checkoutFormData.accepts_marketing ?? true
      },
      vouchers: vouchers,
      attribution: attribution,
      currency: this.getCurrency(),
      success_url: getSuccessUrl(),
      payment_failed_url: getFailureUrl()
    };
    
    return orderData;
  }

  public buildExpressOrder(
    cartItems: any[],
    paymentMethod: 'paypal' | 'apple_pay' | 'google_pay' | 'link',
    vouchers: string[] = []
  ): CreateOrder {
    // Get attribution from store
    const attributionStore = useAttributionStore.getState();
    const attribution = attributionStore.getAttributionForApi();
    
    // Minimal order data - only required fields per API
    const orderData: CreateOrder = {
      lines: cartItems.map(item => ({
        package_id: item.packageId,
        quantity: item.quantity,
        is_upsell: item.is_upsell || false,
        ...(item.properties !== undefined && { properties: item.properties }),
      })),
      payment_detail: {
        payment_method: paymentMethod
      },
      shipping_method: this.getDefaultShippingMethodId(),
      vouchers: vouchers,
      attribution: attribution,
      currency: this.getCurrency(),
      success_url: getSuccessUrl(),
      payment_failed_url: getFailureUrl()
    };
    
    return orderData;
  }

  public buildTestOrder(cartItems: any[], vouchers: string[] = []): any {
    // Build test order data (similar to createOrder but with test card token)
    const testOrderData: any = {
      lines: cartItems.length > 0
        ? cartItems.map(item => ({
            package_id: item.packageId,
            quantity: item.quantity,
            is_upsell: item.is_upsell || false,
            ...(item.properties !== undefined && { properties: item.properties }),
          }))
        : [{ package_id: 1, quantity: 1, is_upsell: false }], // Default package if cart empty
      
      shipping_address: {
        first_name: 'Test',
        last_name: 'Order',
        line1: 'Test Address 123',
        line2: '',
        line4: 'Tempe', // city
        state: 'AZ',
        postcode: '85281',
        country: 'US',
        phone_number: '+14807581224'
      },
      
      billing_same_as_shipping_address: true,
      shipping_method: this.getDefaultShippingMethodId(),
      
      payment_detail: {
        payment_method: 'card_token',
        card_token: 'test_card'
      },
      
      user: {
        email: 'test@test.com',
        first_name: 'Test',
        last_name: 'Order',
        language: 'en',
        phone_number: '+14807581224',
        accepts_marketing: true
      },
      
      vouchers: vouchers,
      attribution: this.getTestAttribution(),
      currency: this.getCurrency(),
      success_url: getSuccessUrl(),
      payment_failed_url: getFailureUrl()
    };
    
    return testOrderData;
  }

  private mapPaymentMethod(method: string): Payment['payment_method'] {
    return toApiPaymentMethod(method);
  }

  private getDefaultShippingMethodId(): number {
    // Import stores at the top of the file if not already imported
    // Using the same pattern as getCurrency() method
    const cartStore = useCartStore.getState();
    const checkoutStore = useCheckoutStore.getState();
    const campaignStore = useCampaignStore.getState();
    
    // Use existing selection first - check cart store
    if (cartStore.shippingMethod?.id) {
      this.logger.debug('Using shipping method from cart:', cartStore.shippingMethod.id);
      return cartStore.shippingMethod.id;
    }
    
    // Then check checkout store
    if (checkoutStore.shippingMethod?.id) {
      this.logger.debug('Using shipping method from checkout:', checkoutStore.shippingMethod.id);
      return checkoutStore.shippingMethod.id;
    }
    
    // Fall back to first available method from campaign
    if (campaignStore.data?.shipping_methods && campaignStore.data.shipping_methods.length > 0) {
      const firstMethod = campaignStore.data.shipping_methods[0];
      if (firstMethod) {
        const firstMethodId = firstMethod.ref_id;
        this.logger.debug('Using first available shipping method:', firstMethodId);
        return firstMethodId;
      }
    }
    
    // Last resort fallback
    this.logger.warn('No shipping method found, using fallback ID 1');
    return 1;
  }

  private getTestAttribution(): Attribution {
    // Get real attribution but override some fields for test
    const attributionStore = useAttributionStore.getState();
    const baseAttribution = attributionStore.getAttributionForApi();
    
    return {
      ...baseAttribution,
      utm_source: 'konami_code',
      utm_medium: 'test',
      utm_campaign: 'debug_test_order',
      utm_content: 'test_mode',
      metadata: {
        ...baseAttribution.metadata,
        test_order: true,
        test_timestamp: Date.now()
      }
    };
  }
}