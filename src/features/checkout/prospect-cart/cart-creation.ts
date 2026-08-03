/**
 * Creating (and, today, no-op "updating") the prospect cart on the server —
 * the actual API call the rest of the feature exists to trigger.
 */

import { useCartStore } from '@/state/cart';
import { useConfigStore } from '@/state/config';
import { useCampaignStore } from '@/state/campaign';
import { useAttributionStore } from '@/state/attribution';
import type { CartBase, UserCreateCart } from '@/types/api';
import type { CartCreationContext } from './prospect-cart.types';

export async function createProspectCart(
  context: CartCreationContext
): Promise<void> {
  if (context.prospectCartRef.value) {
    context.logger.debug('Prospect cart already exists');
    return;
  }

  context.logger.info('Starting prospect cart creation');

  try {
    const cartState = useCartStore.getState();
    const email = context.emailField?.value || '';

    context.logger.debug('Cart state:', {
      isEmpty: cartState.isEmpty,
      itemCount: cartState.items.length,
      items: cartState.items,
      email: email,
    });

    // Don't create cart if no items
    if (cartState.isEmpty || cartState.items.length === 0) {
      context.logger.warn('No items in cart, skipping prospect cart creation');
      return;
    }

    // Get all available form data
    const firstName =
      (
        context.element.querySelector(
          '[data-next-checkout-field="fname"], [os-checkout-field="fname"], input[name="first_name"]'
        ) as HTMLInputElement
      )?.value || '';
    const lastName =
      (
        context.element.querySelector(
          '[data-next-checkout-field="lname"], [os-checkout-field="lname"], input[name="last_name"]'
        ) as HTMLInputElement
      )?.value || '';
    // Get phone in E.164 format if possible
    const phone = context.getFormattedPhoneNumber();

    // Get accepts_marketing checkbox value (defaults to true if not present)
    const acceptsMarketingCheckbox = context.element.querySelector(
      '[data-next-checkout-field="accepts_marketing"], [os-checkout-field="accepts_marketing"], input[name="accepts_marketing"]'
    ) as HTMLInputElement;
    const acceptsMarketing = acceptsMarketingCheckbox?.checked ?? true;

    // NOTE: Address data collection is intentionally disabled
    // We do not send address data with prospect carts

    // Get attribution from the attribution store (this has all the tracking data)
    const attributionStore = useAttributionStore.getState();
    const attribution = attributionStore.getAttributionForApi();

    // Update metadata with current page information since we're on the checkout page
    if (attribution.metadata) {
      // Update landing_page to current URL
      attribution.metadata.landing_page = window.location.href;

      // Update referrer if it's empty
      if (!attribution.metadata.referrer) {
        attribution.metadata.referrer = document.referrer || '';
      }

      // Update domain if it's empty
      if (!attribution.metadata.domain) {
        attribution.metadata.domain = window.location.hostname;
      }

      // Update device if it's empty
      if (!attribution.metadata.device) {
        attribution.metadata.device = navigator.userAgent || '';
      }

      // Update timestamp to current time
      attribution.metadata.timestamp = Date.now();
    }

    // Ensure funnel is set to CH01 for checkout
    if (!attribution.funnel || attribution.funnel === '') {
      attribution.funnel = 'CH01';
    }

    // Build user data
    const user: UserCreateCart = {
      first_name: firstName,
      last_name: lastName,
      language: 'en',
      accepts_marketing: acceptsMarketing,
    };

    // Add email only if it exists
    if (email) {
      user.email = email;
    }

    // Add phone only when it passes validation. Without this guard, trigger
    // modes that don't require phone (formStart, manual, emailEntry) would
    // forward raw partial input to the API.
    if (phone && context.isValidPhone(phone)) {
      user.phone_number = phone;
    } else if (phone) {
      context.logger.debug(
        'Skipping phone on prospect cart payload — failed validation:',
        phone
      );
    }

    // Build cart data according to CartBase interface
    const cartData: CartBase = {
      lines: cartState.items.map(item => ({
        package_id: item.packageId,
        quantity: item.quantity,
        is_upsell: item.is_upsell || false,
        ...(item.properties !== undefined && { properties: item.properties }),
      })),
      user,
      currency: getCurrency(),
    };

    // ADDRESS DATA IS INTENTIONALLY NOT INCLUDED
    // We do not send address data with prospect carts to avoid any potential issues
    // Address will be collected and sent only during the actual checkout process

    // Add attribution if it has data
    if (attribution && Object.keys(attribution).length > 0) {
      cartData.attribution = attribution;
    }

    context.logger.debug('Creating prospect cart with data:', {
      hasAddress: false, // Address is intentionally excluded
      hasAttribution: !!cartData.attribution,
      attribution: attribution,
      userData: cartData.user,
      itemCount: cartData.lines.length,
    });

    // Create cart using standard API
    let cart;
    try {
      cart = await context.apiClient.createCart(cartData);
    } catch (initialError) {
      // If the initial request fails, try with just email
      context.logger.warn(
        'Initial prospect cart creation failed, retrying with minimal data:',
        initialError
      );

      // Only retry if we have a valid email
      if (!context.isValidEmail(email)) {
        throw initialError;
      }

      // Create minimal cart data with just email and cart items
      const minimalCartData: CartBase = {
        lines: cartState.items.map((item: any) => ({
          package_id: item.packageId,
          quantity: item.quantity,
          ...(item.properties !== undefined && { properties: item.properties }),
        })),
        user: {
          email: email,
          first_name: '', // Required field, but empty for minimal cart
          last_name: '', // Required field, but empty for minimal cart
          language: 'en', // Default to English
        },
        currency: getCurrency(),
      };

      // Don't include attribution or address in the retry
      context.logger.info(
        'Retrying prospect cart creation with minimal data (email only)'
      );

      try {
        cart = await context.apiClient.createCart(minimalCartData);
        context.logger.info(
          'Successfully created prospect cart with minimal data'
        );
      } catch (retryError) {
        context.logger.error(
          'Failed to create prospect cart even with minimal data:',
          retryError
        );
        throw retryError;
      }
    }

    // Store cart info as prospect cart
    context.prospectCartRef.value = {
      id: cart.checkout_url || '', // Use checkout URL as ID
      prospect_id: cart.checkout_url || '',
      created_at: new Date().toISOString(),
      expires_at: new Date(
        Date.now() + (context.config.sessionTimeout || 30) * 60 * 1000
      ).toISOString(),
      utm_data: collectUtmData(context),
      cart_data: cart,
    };

    if (email) {
      context.prospectCartRef.value.email = email;
    }

    // Store in session
    sessionStorage.setItem(
      'next_prospect_cart',
      JSON.stringify(context.prospectCartRef.value)
    );

    // Emit event
    context.emitProspectEvent('cart-created', {
      cart,
      prospectCart: context.prospectCartRef.value,
    });

    context.logger.info(
      'Prospect cart created with checkout URL:',
      cart.checkout_url
    );
  } catch (error) {
    context.logger.error('Failed to create prospect cart:', error);
  }
}

export async function updateProspectCart(
  context: CartCreationContext
): Promise<void> {
  if (!context.prospectCartRef.value) return;

  // Since we're using standard cart API, we don't update existing carts
  // Instead, we'll create a new one if needed
  context.logger.debug(
    'Prospect cart update skipped - using standard cart API'
  );
}

export function collectUtmData(
  context: Pick<CartCreationContext, 'logger'>
): Record<string, string> {
  const params = new URLSearchParams(window.location.search);
  const utmData: Record<string, string> = {};

  const utmParams = [
    'utm_source',
    'utm_medium',
    'utm_campaign',
    'utm_term',
    'utm_content',
  ];

  utmParams.forEach(param => {
    const value = params.get(param);
    if (value) {
      utmData[param] = value;
    }
  });

  // Also check for stored UTM data from previous pages
  const storedUtm = sessionStorage.getItem('next_utm_data');
  if (storedUtm) {
    try {
      const stored = JSON.parse(storedUtm);
      Object.assign(utmData, stored);
    } catch (error) {
      context.logger.warn('Failed to parse stored UTM data:', error);
    }
  }

  // Store current UTM data for future use
  if (Object.keys(utmData).length > 0) {
    sessionStorage.setItem('next_utm_data', JSON.stringify(utmData));
  }

  return utmData;
}

export function getCurrency(): string {
  return (
    useCampaignStore.getState()?.currency ??
    useConfigStore.getState().getCurrency()
  );
}
