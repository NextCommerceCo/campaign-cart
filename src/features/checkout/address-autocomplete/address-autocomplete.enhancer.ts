import { createLogger } from '@/core/logger';
import { EventBus } from '@/core/events';
import type { IApiClient } from '@/api/client.types';
import { GoogleMapsAutocomplete } from './google-maps-autocomplete';
import { NextCommerceAutocomplete } from './next-commerce-autocomplete';
import type { AutocompleteContext } from '../checkout.types';

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
  private apiClient: IApiClient;

  private googleMaps?: GoogleMapsAutocomplete;
  private nextCommerce?: NextCommerceAutocomplete;
  private listenerAbort = new AbortController();
  private enabled: AddressAutocompleteOptions = {
    enableGoogleMaps: false,
    enableNextCommerce: false,
  };
  private loaded = false;

  constructor(deps: {
    fields: Map<string, HTMLElement>;
    billingFields: Map<string, HTMLElement>;
    apiClient: IApiClient;
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

    this.enabled = options;
    this.setupLazyLoading();
  }

  /**
   * Binds the loaded provider to the address fields as they now stand.
   *
   * `data-next-address` replaces every input when the country changes, so a provider set
   * up against the previous ones is attached to elements no longer on the page. A form
   * whose address fields never change never calls this.
   */
  public async rebind(): Promise<void> {
    if (!this.loaded) return;

    try {
      this.googleMaps?.destroy();
      this.nextCommerce?.destroy();
      await this.googleMaps?.setup();
      this.nextCommerce?.setup();
      this.ctx.logger.debug('Address autocomplete rebound to the current address fields');
    } catch (error) {
      this.ctx.logger.error('Failed to rebind address autocomplete:', error);
    }
  }

  public destroy(): void {
    this.listenerAbort.abort();
    this.googleMaps?.destroy();
    this.nextCommerce?.destroy();
  }

  // ============================================================================
  // LAZY LOADING
  // ============================================================================

  /**
   * Waits for a focus on an address field, wherever that field comes from.
   *
   * One delegated listener rather than one per input, because the input it is waiting for
   * may not exist yet: `data-next-address` builds its fields after this runs, and builds
   * new ones every time the country changes. Reading the field map when the event fires
   * instead of when the listener is attached is what makes both cases work — bound to the
   * elements directly, this loaded for a hand-written form and never for a built one.
   */
  private setupLazyLoading(): void {
    let isLoading = false;

    // Not provable in a browser test with the NextCommerce provider, which builds no UI
    // until it has results: the guard's only effect is that an unrelated focus does not
    // load a provider at all, which matters most for Google Maps and its external script.
    const isAddressField = (target: EventTarget | null): boolean => {
      const { fields, billingFields } = this.ctx;
      return (
        target === fields.get('address1') ||
        target === billingFields.get('billing-address1')
      );
    };

    document.addEventListener(
      'focusin',
      async event => {
        if (this.loaded || isLoading || !isAddressField(event.target)) return;
        isLoading = true;
        this.ctx.logger.info('User focused on address field, loading autocomplete...');

        try {
          if (this.enabled.enableGoogleMaps) {
            this.googleMaps = new GoogleMapsAutocomplete(this.ctx);
            await this.googleMaps.setup();
          } else if (this.enabled.enableNextCommerce) {
            this.nextCommerce = new NextCommerceAutocomplete(this.ctx, this.apiClient);
            this.nextCommerce.setup();
          }
          this.loaded = true;
        } catch (error) {
          this.ctx.logger.error('Failed to load autocomplete on focus:', error);
        } finally {
          isLoading = false;
        }
      },
      { signal: this.listenerAbort.signal }
    );
  }
}
