import { useCheckoutStore } from '@/stores/checkoutStore';
import { nextAnalytics, EcommerceEvents } from '@/utils/analytics/index';
import type { AutocompleteContext } from '../types';
import { createCloseButton } from '../utils/create-close-button';

export class GoogleMapsAutocomplete {
  private ctx: AutocompleteContext;

  private googleMapsLoaded = false;
  private googleMapsLoading = false;
  private googleMapsLoadPromise: Promise<void> | null = null;
  private autocompleteInstances: Map<string, any> = new Map();
  private countryListenersAttached = false;

  constructor(ctx: AutocompleteContext) {
    this.ctx = ctx;
  }

  public async setup(): Promise<void> {
    await this.loadGoogleMapsAPI();
    await new Promise(resolve => setTimeout(resolve, 100));

    this.ctx.logger.debug('Google Maps status:', {
      google: typeof window.google !== 'undefined',
      maps: typeof window.google?.maps !== 'undefined',
      places: typeof window.google?.maps?.places !== 'undefined',
      Autocomplete: typeof window.google?.maps?.places?.Autocomplete !== 'undefined',
    });

    if (!this.isPlacesAvailable()) {
      this.ctx.logger.warn('Google Places API not available, skipping autocomplete setup');
      return;
    }

    this.ctx.logger.debug('Google Maps API loaded, setting up autocomplete');
    this.createInstances();
  }

  public destroy(): void {
    this.autocompleteInstances.clear();
  }

  // ============================================================================
  // API LOADING
  // ============================================================================

  private async loadGoogleMapsAPI(): Promise<void> {
    if (this.googleMapsLoaded) {
      this.ctx.logger.debug('Google Maps API already loaded');
      return;
    }

    if (this.googleMapsLoading) {
      this.ctx.logger.debug('Google Maps API loading in progress, waiting...');
      return this.googleMapsLoadPromise!;
    }

    const { useConfigStore } = await import('@/stores/configStore');
    const googleMapsConfig = useConfigStore.getState().googleMapsConfig;

    if (googleMapsConfig.enableAutocomplete === false) {
      this.ctx.logger.debug('Google Maps Autocomplete is disabled in configuration');
      return;
    }

    if (!googleMapsConfig.apiKey) {
      this.ctx.logger.warn('Google Maps API key not found. Autocomplete will be disabled.');
      return;
    }

    this.googleMapsLoading = true;
    this.googleMapsLoadPromise = this.loadScript(googleMapsConfig);

    try {
      await this.googleMapsLoadPromise;
      this.googleMapsLoaded = true;
      this.ctx.logger.info('Google Maps API loaded successfully');
    } catch (error) {
      this.ctx.logger.error('Failed to load Google Maps API:', error);
      // Don't throw — autocomplete failure shouldn't break checkout
    } finally {
      this.googleMapsLoading = false;
    }
  }

  private async loadScript(config: any): Promise<void> {
    if (typeof window.google !== 'undefined' && typeof window.google.maps !== 'undefined') {
      this.ctx.logger.debug('Google Maps API already available');
      return;
    }

    const isGooglePlacesReady = () =>
      typeof window.google !== 'undefined' &&
      typeof window.google.maps?.places?.Autocomplete !== 'undefined';

    const waitForPlaces = async (reject: (e: Error) => void, errorMsg: string): Promise<void> => {
      let attempts = 0;
      const maxAttempts = 10;
      while (attempts < maxAttempts) {
        if (isGooglePlacesReady()) {
          return;
        }
        attempts++;
        this.ctx.logger.debug(`Waiting for Google Maps API... (attempt ${attempts}/${maxAttempts})`);
        await new Promise(r => setTimeout(r, 100));
      }
      reject(new Error(errorMsg));
    };

    return new Promise((resolve, reject) => {
      const existingScript = document.querySelector(`script[src*="maps.googleapis.com"]`);
      if (existingScript) {
        this.ctx.logger.debug('Google Maps script already in DOM, waiting for load...');
        if (isGooglePlacesReady()) { resolve(); return; }
        waitForPlaces(reject, 'Existing Google Maps script failed to fully initialize').then(resolve);
        return;
      }

      const regionParam = config.region ? `&region=${config.region}` : '';
      const script = document.createElement('script');
      script.src = `https://maps.googleapis.com/maps/api/js?key=${config.apiKey}&libraries=places${regionParam}&loading=async`;
      script.async = true;
      script.defer = true;

      script.onload = async () => {
        this.ctx.logger.debug('Google Maps API script loaded successfully');
        waitForPlaces(reject, 'Google Maps API not fully available after script load').then(resolve);
      };

      script.onerror = () => {
        const error = new Error('Failed to load Google Maps API script');
        this.ctx.logger.error(error.message);
        reject(error);
      };

      document.head.appendChild(script);
    });
  }

  private isPlacesAvailable(): boolean {
    return (
      this.googleMapsLoaded &&
      typeof window.google !== 'undefined' &&
      typeof window.google.maps?.places?.Autocomplete !== 'undefined'
    );
  }

  // ============================================================================
  // AUTOCOMPLETE INSTANCES
  // ============================================================================

  private createInstances(): void {
    const { fields, billingFields, getDetectedCountryCode } = this.ctx;
    const defaultCountry = getDetectedCountryCode() || 'US';

    const addressField = fields.get('address1');
    if (addressField instanceof HTMLInputElement) {
      this.createInstance(addressField, 'address1', defaultCountry, 'shipping');
    }

    const billingAddressField = billingFields.get('billing-address1');
    if (billingAddressField instanceof HTMLInputElement) {
      this.createInstance(billingAddressField, 'billing-address1', defaultCountry, 'billing');
    }

    this.setupCountryChangeListeners();
  }

  private createInstance(
    input: HTMLInputElement,
    fieldKey: string,
    defaultCountry: string,
    type: 'shipping' | 'billing'
  ): void {
    try {
      const { fields, billingFields } = this.ctx;
      const countryField = type === 'shipping' ? fields.get('country') : billingFields.get('billing-country');
      const countryValue = (countryField instanceof HTMLSelectElement && countryField.value)
        ? countryField.value
        : defaultCountry;

      if (!window.google?.maps?.places?.Autocomplete) {
        this.ctx.logger.warn('Google Maps Autocomplete API not available');
        return;
      }

      const autocomplete = new window.google.maps.places.Autocomplete(input, {
        types: ['address'],
        fields: ['address_components', 'formatted_address'],
        componentRestrictions: { country: countryValue },
      });
      this.autocompleteInstances.set(fieldKey, autocomplete);
      this.ctx.logger.debug(`Autocomplete created for ${fieldKey}, restricted to: ${countryValue}`);

      const addCloseButton = () => {
        const pacContainer = document.querySelector('.pac-container:not([data-close-added])') as HTMLElement;
        if (!pacContainer) return;
        pacContainer.setAttribute('data-close-added', 'true');
        pacContainer.appendChild(createCloseButton(() => {
          pacContainer.style.display = 'none';
          input.blur();
        }));
      };

      autocomplete.addListener('place_changed', async () => {
        const place = autocomplete.getPlace();
        if (!place?.address_components) {
          this.ctx.logger.debug('No valid place data returned from autocomplete');
          return;
        }
        await this.fillAddress(place, type);
      });

      input.addEventListener('focus', () => setTimeout(addCloseButton, 100));
      input.addEventListener('keydown', (e) => { if (e.key === 'Enter') e.preventDefault(); });

    } catch (error) {
      this.ctx.logger.error(`Failed to create autocomplete for ${fieldKey}:`, error);
    }
  }

  private setupCountryChangeListeners(): void {
    if (this.countryListenersAttached) return;

    const { fields, billingFields } = this.ctx;

    const shippingCountryField = fields.get('country');
    if (shippingCountryField instanceof HTMLSelectElement) {
      (shippingCountryField as any)._hasAutocompleteHandler = true;
      shippingCountryField.addEventListener('change', () => {
        const autocomplete = this.autocompleteInstances.get('address1');
        const countryValue = shippingCountryField.value;
        if (autocomplete?.setComponentRestrictions && countryValue?.length === 2) {
          autocomplete.setComponentRestrictions({ country: countryValue });
          this.ctx.logger.debug(`Shipping autocomplete restricted to: ${countryValue}`);
        }
      });
    }

    const billingCountryField = billingFields.get('billing-country');
    if (billingCountryField instanceof HTMLSelectElement) {
      billingCountryField.addEventListener('change', () => {
        const autocomplete = this.autocompleteInstances.get('billing-address1');
        const countryValue = billingCountryField.value;
        if (autocomplete?.setComponentRestrictions && countryValue?.length === 2) {
          autocomplete.setComponentRestrictions({ country: countryValue });
          this.ctx.logger.debug(`Billing autocomplete restricted to: ${countryValue}`);
        }
      });
    }

    this.countryListenersAttached = true;
  }

  // ============================================================================
  // ADDRESS FILL
  // ============================================================================

  private async fillAddress(place: any, type: 'shipping' | 'billing'): Promise<void> {
    const components = this.parseAddressComponents(place.address_components);
    if (!components) {
      this.ctx.logger.warn('Failed to parse address components');
      return;
    }

    const { fields, billingFields, eventBus } = this.ctx;
    const isShipping = type === 'shipping';
    const fieldPrefix = isShipping ? '' : 'billing-';
    const fieldMap = isShipping ? fields : billingFields;
    const countryCode = components.country?.short;
    const checkoutStore = useCheckoutStore.getState();

    // Address line 1
    const addressField = fieldMap.get(`${fieldPrefix}address1`);
    if (addressField instanceof HTMLInputElement) {
      addressField.value = this.formatAddressLine1(components, countryCode);
      addressField.dispatchEvent(new Event('change', { bubbles: true }));
    }

    // Brazil: parse city/state from formatted_address if components missing
    let parsedCity = '';
    let parsedState = '';
    if (countryCode === 'BR' && place.formatted_address &&
      (!components.administrative_area_level_2 || !components.administrative_area_level_1)) {
      const parts = place.formatted_address.split(',');
      if (parts.length >= 3) {
        const cityStatePart = parts[parts.length - 3]?.trim();
        if (cityStatePart?.includes(' - ')) {
          [parsedCity, parsedState] = cityStatePart.split(' - ').map((s: string) => s.trim());
        }
      }
    }

    // City
    const cityField = fieldMap.get(`${fieldPrefix}city`);
    if (cityField instanceof HTMLInputElement) {
      const cityValue = this.extractCity(components, countryCode, parsedCity);
      if (cityValue) {
        cityField.value = cityValue;
        cityField.dispatchEvent(new Event('change', { bubbles: true }));
        this.ctx.logger.debug(`City set to: ${cityValue}`);
      } else {
        this.ctx.logger.warn('No suitable city component found in address');
      }
    }

    // Postal
    const zipField = fieldMap.get(`${fieldPrefix}postal`);
    if (zipField instanceof HTMLInputElement && components.postal_code) {
      zipField.value = components.postal_code.long;
      zipField.dispatchEvent(new Event('change', { bubbles: true }));
    }

    // Country + State
    const countryField = fieldMap.get(`${fieldPrefix}country`);
    if (countryField instanceof HTMLSelectElement && components.country) {
      if (countryField.value !== countryCode) {
        countryField.value = countryCode!;
        countryField.dispatchEvent(new Event('change', { bubbles: true }));
        this.ctx.logger.debug(`Country set to ${countryCode}`);
      }
      const stateField = fieldMap.get(`${fieldPrefix}province`);
      if (stateField instanceof HTMLSelectElement) {
        const stateCode = components.administrative_area_level_1?.short || (countryCode === 'BR' ? parsedState : '');
        if (stateCode) this.setStateWithRetry(stateField, stateCode);
      }
    }

    // Update store
    const updates: Record<string, string> = {};
    const line1 = this.formatAddressLine1(components, countryCode);
    if (line1) updates.address1 = line1;
    const city = this.extractCity(components, countryCode, parsedCity);
    if (city) updates.city = city;
    if (components.postal_code) updates.postal = components.postal_code.long;
    if (components.country) updates.country = components.country.short;
    if (components.administrative_area_level_1) updates.province = components.administrative_area_level_1.short;

    if (isShipping) {
      checkoutStore.updateFormData(updates);

      if (!this.ctx.getHasTrackedShippingInfo() && updates.city && updates.province) {
        try {
          const shippingMethod = checkoutStore.shippingMethod;
          const shippingTier = shippingMethod ? shippingMethod.name : 'Standard';
          nextAnalytics.track(EcommerceEvents.createAddShippingInfoEvent(shippingTier));
          this.ctx.setHasTrackedShippingInfo(true);
          this.ctx.logger.info('Tracked add_shipping_info event (Google Places autofill)', { shippingTier });
        } catch (error) {
          this.ctx.logger.warn('Failed to track add_shipping_info event after autofill:', error);
        }
      }
    } else {
      const currentBillingData = checkoutStore.billingAddress || {
        first_name: '', last_name: '', address1: '', city: '', province: '', postal: '', country: '', phone: ''
      };
      checkoutStore.setBillingAddress({ ...currentBillingData, ...updates });
    }

    eventBus.emit('address:autocomplete-filled', { type, components });
  }

  private formatAddressLine1(
    components: Record<string, { long: string; short: string }>,
    countryCode: string | undefined
  ): string {
    const streetNumber = components.street_number?.long || '';
    const route = components.route?.long || '';

    if (countryCode === 'BR' && route && streetNumber) {
      let value = `${route}, ${streetNumber}`;
      if (components.sublocality_level_1) value += ` - ${components.sublocality_level_1.long}`;
      else if (components.sublocality) value += ` - ${components.sublocality.long}`;
      return value;
    }

    return [streetNumber, route].filter(Boolean).join(' ');
  }

  private extractCity(
    components: Record<string, { long: string; short: string }>,
    countryCode: string | undefined,
    parsedCity: string
  ): string {
    if (countryCode === 'BR') {
      return components.administrative_area_level_2?.long || parsedCity;
    }
    return (
      components.locality?.long ||
      components.postal_town?.long ||
      components.administrative_area_level_2?.long ||
      (countryCode !== 'BR' ? components.sublocality?.long : '') ||
      (countryCode !== 'BR' ? components.sublocality_level_1?.long : '') ||
      ''
    );
  }

  private parseAddressComponents(addressComponents: any[]): Record<string, { long: string; short: string }> {
    const components: Record<string, { long: string; short: string }> = {};
    addressComponents.forEach(component => {
      component.types.forEach((type: string) => {
        if (type !== 'political') {
          components[type] = { long: component.long_name, short: component.short_name };
        }
      });
    });
    this.ctx.logger.debug('Parsed address components:', {
      availableTypes: Object.keys(components),
      cityRelatedComponents: {
        locality: components.locality?.long,
        postal_town: components.postal_town?.long,
        sublocality: components.sublocality?.long,
        sublocality_level_1: components.sublocality_level_1?.long,
      },
    });
    return components;
  }

  private async setStateWithRetry(stateSelect: HTMLSelectElement, stateCode: string, attempt = 0): Promise<void> {
    if (attempt >= 5) {
      this.ctx.logger.warn(`Failed to set state ${stateCode} after 5 attempts`);
      return;
    }
    await new Promise(resolve => setTimeout(resolve, 300 * Math.pow(1.5, attempt)));
    const hasOption = Array.from(stateSelect.options).some(opt => opt.value === stateCode);
    if (hasOption) {
      stateSelect.value = stateCode;
      stateSelect.dispatchEvent(new Event('change', { bubbles: true }));
      this.ctx.logger.debug(`State set to ${stateCode}`);
    } else {
      this.setStateWithRetry(stateSelect, stateCode, attempt + 1);
    }
  }
}
