import { createLogger } from '@/utils/logger';
import { EventBus } from '@/utils/events';
import { ApiClient } from '@/api/client';
import { GoogleMapsAutocomplete } from './GoogleMapsAutocomplete';
import { NextCommerceAutocomplete } from './NextCommerceAutocomplete';
import type { AutocompleteContext } from '../types';

export interface AddressAutocompleteOptions {
  enableGoogleMaps: boolean;
  enableNextCommerce: boolean;
}

/**
 * Wires address-field autocomplete into the checkout form using one of two
 * providers: Google Maps Places or NextCommerce's own address lookup.
 *
 * This is not a `data-next-*` enhancer — it has no activation attribute and is
 * not registered in `AttributeScanner`. `CheckoutFormEnhancer` constructs it
 * directly, passing in the already-scanned shipping/billing field maps, and
 * decides which providers to enable from SDK config (`googleMapsConfig` and
 * `addressConfig.enableAutocomplete`). When both are enabled Google Maps wins.
 * Either provider is loaded lazily on the first `focus` of the `address1` (or
 * `billing-address1`) input, so the autocomplete script is never fetched until
 * the shopper actually starts entering an address. On selection it fills the
 * mapped address fields and emits `address:autocomplete-filled` so the form can
 * reveal its location (city/state/zip) fields.
 *
 * Configuration comes entirely from constructor dependencies and the
 * `initialize` options object — it reads no attributes off any DOM element.
 *
 * @example
 * ```ts
 * const autocomplete = new AddressAutocompleteEnhancer({
 *   fields,
 *   billingFields,
 *   apiClient,
 *   getDetectedCountryCode: () => 'US',
 *   getHasTrackedShippingInfo: () => false,
 *   setHasTrackedShippingInfo: () => {},
 * });
 * await autocomplete.initialize({ enableNextCommerce: true, enableGoogleMaps: false });
 * ```
 */
export class AddressAutocompleteEnhancer {
  private ctx: AutocompleteContext;
  private apiClient: ApiClient;

  private googleMaps?: GoogleMapsAutocomplete;
  private nextCommerce?: NextCommerceAutocomplete;

  constructor(deps: {
    fields: Map<string, HTMLElement>;
    billingFields: Map<string, HTMLElement>;
    apiClient: ApiClient;
    getDetectedCountryCode: () => string;
    getHasTrackedShippingInfo: () => boolean;
    setHasTrackedShippingInfo: (value: boolean) => void;
  }) {
    this.apiClient = deps.apiClient;
    this.ctx = {
      fields: deps.fields,
      billingFields: deps.billingFields,
      getDetectedCountryCode: deps.getDetectedCountryCode,
      getHasTrackedShippingInfo: deps.getHasTrackedShippingInfo,
      setHasTrackedShippingInfo: deps.setHasTrackedShippingInfo,
      logger: createLogger('AddressAutocompleteEnhancer'),
      eventBus: EventBus.getInstance(),
    };
  }

  public async initialize(options: AddressAutocompleteOptions): Promise<void> {
    const { enableGoogleMaps, enableNextCommerce } = options;

    if (!enableGoogleMaps && !enableNextCommerce) {
      this.ctx.logger.debug('All autocomplete providers disabled, skipping initialization');
      return;
    }

    this.setupLazyLoading(enableGoogleMaps, enableNextCommerce);
  }

  public destroy(): void {
    this.googleMaps?.destroy();
  }

  // ============================================================================
  // LAZY LOADING
  // ============================================================================

  private setupLazyLoading(enableGoogleMaps: boolean, enableNextCommerce: boolean): void {
    const { fields, billingFields } = this.ctx;
    const addressField = fields.get('address1');
    const billingAddressField = billingFields.get('billing-address1');

    let isLoading = false;
    let isLoaded = false;

    const loadOnFocus = async () => {
      if (isLoaded || isLoading) return;
      isLoading = true;
      this.ctx.logger.info('User focused on address field, loading autocomplete...');

      try {
        if (enableGoogleMaps) {
          this.googleMaps = new GoogleMapsAutocomplete(this.ctx);
          await this.googleMaps.setup();
        } else if (enableNextCommerce) {
          this.nextCommerce = new NextCommerceAutocomplete(this.ctx, this.apiClient);
          this.nextCommerce.setup();
        }
        isLoaded = true;
        addressField?.removeEventListener('focus', loadOnFocus);
        billingAddressField?.removeEventListener('focus', loadOnFocus);
      } catch (error) {
        this.ctx.logger.error('Failed to load autocomplete on focus:', error);
      } finally {
        isLoading = false;
      }
    };

    if (addressField instanceof HTMLInputElement) {
      addressField.addEventListener('focus', loadOnFocus);
    }
    if (billingAddressField instanceof HTMLInputElement) {
      billingAddressField.addEventListener('focus', loadOnFocus);
    }
  }
}
