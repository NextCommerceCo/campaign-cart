import { ApiClient } from '@/api/client';
import { useCheckoutStore } from '@/stores/checkoutStore';
import type { AddressAutocompleteResult } from '@/types/api';
import { nextAnalytics, EcommerceEvents } from '@/utils/analytics/index';
import { type AutocompleteContext, createCloseButton } from './types';

export class NextCommerceAutocomplete {
  private ctx: AutocompleteContext;
  private apiClient: ApiClient;

  constructor(ctx: AutocompleteContext, apiClient: ApiClient) {
    this.ctx = ctx;
    this.apiClient = apiClient;
  }

  public setup(): void {
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
  }

  // ============================================================================
  // AUTOCOMPLETE INSTANCE
  // ============================================================================

  private createInstance(
    input: HTMLInputElement,
    fieldKey: string,
    defaultCountry: string,
    type: 'shipping' | 'billing'
  ): void {
    try {
      const { fields, billingFields } = this.ctx;
      const countryField = type === 'shipping' ? fields.get('country') : billingFields.get('billing-country');
      let countryValue = (countryField instanceof HTMLSelectElement && countryField.value)
        ? countryField.value
        : defaultCountry;

      let abortController: AbortController | null = null;
      let debounceTimer: ReturnType<typeof setTimeout> | null = null;

      const addCloseButtonToContainer = () => {
        const pacContainer = document.querySelector('.pac-container-nextcommerce:not([data-close-added])') as HTMLElement;
        if (!pacContainer) return;
        pacContainer.setAttribute('data-close-added', 'true');
        pacContainer.appendChild(createCloseButton(() => {
          pacContainer.style.display = 'none';
          input.blur();
        }));
      };

      const getOrCreatePacContainer = (): HTMLElement => {
        let pac = document.querySelector<HTMLElement>('.pac-container-nextcommerce.pac-logo');
        if (!pac) {
          pac = document.createElement('div');
          pac.className = 'pac-container-nextcommerce pac-logo';
          pac.style.cssText = 'display:block; position:absolute';
          pac.addEventListener('mousedown', (e) => e.preventDefault());
          document.body.appendChild(pac);
        } else {
          pac.removeAttribute('data-close-added');
        }
        return pac;
      };

      const showSuggestions = async () => {
        abortController?.abort();
        abortController = new AbortController();
        countryValue = (countryField instanceof HTMLSelectElement && countryField.value)
          ? countryField.value
          : defaultCountry;

        const rect = input.getBoundingClientRect();

        try {
          if (!input.value) return;
          const result = await this.apiClient.getAddressesAutocomplete(
            input.value, countryValue, undefined, abortController.signal
          );

          if (!result.results.length) {
            document.querySelector('.pac-container-nextcommerce.pac-logo')?.remove();
            return;
          }

          const pacContainer = getOrCreatePacContainer();
          pacContainer.style.left = `${rect.left + window.scrollX}px`;
          pacContainer.style.top = `${rect.bottom + window.scrollY}px`;
          pacContainer.style.width = `${rect.width}px`;
          pacContainer.replaceChildren(...result.results.map((r: AddressAutocompleteResult) => this.buildItem(r, input, type)));
          addCloseButtonToContainer();
        } catch (e) {
          if (e instanceof DOMException && e.name === 'AbortError') return;
          throw e;
        }
      };

      input.addEventListener('focus', showSuggestions);
      input.addEventListener('blur', () => {
        setTimeout(() => document.querySelector('.pac-container-nextcommerce.pac-logo')?.remove(), 150);
      });
      input.addEventListener('keydown', (e) => { if (e.key === 'Enter') e.preventDefault(); });
      input.addEventListener('input', () => {
        if (debounceTimer) clearTimeout(debounceTimer);
        debounceTimer = setTimeout(showSuggestions, 300);
      });

    } catch (error) {
      this.ctx.logger.error(`Failed to create autocomplete for ${fieldKey}:`, error);
    }
  }

  private buildItem(r: AddressAutocompleteResult, input: HTMLInputElement, type: 'shipping' | 'billing'): HTMLDivElement {
    const item = document.createElement('div');
    item.className = 'pac-item-nextcommerce';

    const icon = document.createElement('span');
    icon.className = 'pac-icon pac-icon-marker';

    item.append(icon, this.buildHighlightedLabel(r.label, input.value));
    item.addEventListener('click', () => {
      this.fillAddress(r, type);
      input.blur();
    });
    return item;
  }

  private buildHighlightedLabel(text: string, query: string): HTMLSpanElement {
    const label = document.createElement('span');
    label.className = 'pac-item-query';
    const words = query.split(/\s+/).filter(Boolean);
    if (!words.length) {
      label.textContent = text;
      return label;
    }
    const escaped = words.map(w => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
    const pattern = new RegExp(`(${escaped.join('|')})`, 'gi');
    label.append(...text.split(pattern).map(part =>
      words.some(w => w.toLowerCase() === part.toLowerCase())
        ? Object.assign(document.createElement('b'), { textContent: part })
        : document.createTextNode(part)
    ));
    return label;
  }

  // ============================================================================
  // ADDRESS FILL
  // ============================================================================

  private async fillAddress(place: AddressAutocompleteResult, type: 'shipping' | 'billing'): Promise<void> {
    if (!place) return;

    const { fields, billingFields, eventBus } = this.ctx;
    const isShipping = type === 'shipping';
    const fieldPrefix = isShipping ? '' : 'billing-';
    const fieldMap = isShipping ? fields : billingFields;
    const { line1, city, state, state_code, postcode, country, country_code } = place.address;

    const set = (key: string, value: string) => {
      const el = fieldMap.get(`${fieldPrefix}${key}`);
      if (el instanceof HTMLInputElement && value) {
        el.value = value;
        el.dispatchEvent(new Event('change', { bubbles: true }));
      }
    };

    set('address1', line1);
    set('city', city);
    set('postal', postcode);

    if (country) {
      const countryField = fieldMap.get(`${fieldPrefix}country`);
      if (countryField instanceof HTMLSelectElement && countryField.value !== country_code) {
        countryField.value = country_code;
        countryField.dispatchEvent(new Event('change', { bubbles: true }));
        this.ctx.logger.debug(`Country set to ${country_code}`);
      }

      const stateField = fieldMap.get(`${fieldPrefix}province`);
      if (stateField instanceof HTMLSelectElement && (state || state_code)) {
        this.setStateWithRetry(stateField, state_code, state);
      }
    }

    const checkoutStore = useCheckoutStore.getState();
    const addressUpdates = {
      ...(line1 && { address1: line1 }),
      ...(city && { city }),
      ...(state_code && { province: state_code }),
      ...(postcode && { postal: postcode }),
      ...(country_code && { country: country_code }),
    };

    if (isShipping) {
      checkoutStore.updateFormData(addressUpdates);

      if (!this.ctx.getHasTrackedShippingInfo() && city && state_code) {
        try {
          const shippingMethod = checkoutStore.shippingMethod;
          const shippingTier = shippingMethod ? shippingMethod.name : 'Standard';
          nextAnalytics.track(EcommerceEvents.createAddShippingInfoEvent(shippingTier));
          this.ctx.setHasTrackedShippingInfo(true);
          this.ctx.logger.info('Tracked add_shipping_info event (NextCommerce autofill)', { shippingTier });
        } catch (error) {
          this.ctx.logger.warn('Failed to track add_shipping_info event after autofill:', error);
        }
      }
    } else {
      const currentBillingData = checkoutStore.billingAddress || {
        first_name: '', last_name: '', address1: '', city: '', province: '', postal: '', country: '', phone: ''
      };
      checkoutStore.setBillingAddress({ ...currentBillingData, ...addressUpdates });
    }

    eventBus.emit('address:autocomplete-filled', { type, components: place });
  }

  private async setStateWithRetry(
    stateSelect: HTMLSelectElement,
    stateCode: string,
    stateName: string,
    attempt = 0
  ): Promise<void> {
    if (attempt >= 5) {
      this.ctx.logger.warn(`Failed to set state ${stateCode} after 5 attempts`);
      return;
    }
    await new Promise(resolve => setTimeout(resolve, 300 * Math.pow(1.5, attempt)));

    const options = Array.from(stateSelect.options);
    const match =
      (stateCode && options.find(opt => opt.value === stateCode)) ||
      (stateName && options.find(opt => opt.text.toLowerCase().trim().includes(stateName.toLowerCase().trim())));

    if (match) {
      stateSelect.value = (match as HTMLOptionElement).value;
      stateSelect.dispatchEvent(new Event('change', { bubbles: true }));
      this.ctx.logger.debug(`State set to ${(match as HTMLOptionElement).value}`);
    } else {
      this.setStateWithRetry(stateSelect, stateCode, stateName, attempt + 1);
    }
  }
}
