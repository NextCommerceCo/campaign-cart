import { createLogger } from '@/utils/logger';
import { EventBus } from '@/utils/events';
import { ApiClient } from '@/api/client';
import { GoogleMapsAutocomplete } from './GoogleMapsAutocomplete';
import { NextCommerceAutocomplete } from './NextCommerceAutocomplete';
import type { AutocompleteContext } from './types';

export interface AddressAutocompleteOptions {
  enableGoogleMaps: boolean;
  enableNextCommerce: boolean;
}

/**
 * Orchestrates address autocomplete providers (NextCommerce / Google Maps).
 *
 * Usage:
 *   const enhancer = new AddressAutocompleteEnhancer({ fields, billingFields, apiClient, ... });
 *   await enhancer.initialize({ enableNextCommerce: true, enableGoogleMaps: false });
 *   // Call enhancer.destroy() when the checkout form is torn down.
 *
 * Provider priority: Google Maps > NextCommerce.
 * Both providers load lazily on first focus of an address field.
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
