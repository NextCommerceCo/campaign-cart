import { ApiClient } from '@/api/client';
import { useCheckoutStore } from '@/stores/checkoutStore';
import type { AddressAutocomplete as AddressAutocompleteData, AddressAutocompleteResult } from '@/types/api';
import { nextAnalytics, EcommerceEvents } from '@/utils/analytics/index';
import type { AutocompleteContext } from '../types';
import { createCloseButton } from '../utils/create-close-button';

class AddressAutocomplete {
  private input: HTMLInputElement;
  private ctx: AutocompleteContext;
  private apiClient: ApiClient;
  private type: 'shipping' | 'billing';
  private defaultCountry: string;

  private _addressSuggestionContainer: HTMLElement | null = null;
  private _activeIndex = -1;
  private _keyNavigating = false;
  private _currentAddresses: AddressAutocompleteResult[] = [];
  private _originalSearchText: string | null = null;
  private _abortController: AbortController | null = null;
  private _lastData: AddressAutocompleteData | null = null;
  private _lastSearchText: string | null = null;
  private _documentClickHandler: ((e: MouseEvent) => void) | null = null;

  constructor(
    input: HTMLInputElement,
    ctx: AutocompleteContext,
    apiClient: ApiClient,
    type: 'shipping' | 'billing',
    defaultCountry: string
  ) {
    this.input = input;
    this.ctx = ctx;
    this.apiClient = apiClient;
    this.type = type;
    this.defaultCountry = defaultCountry;
    this._init();
  }

  private _getCountryValue(): string {
    const { fields, billingFields } = this.ctx;
    const key = this.type === 'shipping' ? 'country' : 'billing-country';
    const fieldMap = this.type === 'shipping' ? fields : billingFields;
    const field = fieldMap.get(key);
    return (field instanceof HTMLSelectElement && field.value) ? field.value : this.defaultCountry;
  }

  private _isValidSearchText(text: string): boolean {
    return /\S\s+\S/.test(text);
  }

  private _getAddressItems(): HTMLElement[] {
    return this._addressSuggestionContainer
      ? Array.from(this._addressSuggestionContainer.querySelectorAll<HTMLElement>('.pac-item-nextcommerce'))
      : [];
  }

  private _setActiveIndex(index: number): void {
    const items = this._getAddressItems();
    items.forEach((item, i) => item.classList.toggle('pac-item-nextcommerce--active', i === index));
    this._activeIndex = index;
    this.input.value = (index >= 0 && this._currentAddresses[index])
      ? this._currentAddresses[index].label
      : (this._originalSearchText ?? '');
  }

  private _tearDownAddressSuggestion(): void {
    if (this._originalSearchText !== null) {
      this.input.value = this._originalSearchText;
      this._originalSearchText = null;
    }
    if (this._documentClickHandler) {
      document.removeEventListener('click', this._documentClickHandler);
      this._documentClickHandler = null;
    }
    this._addressSuggestionContainer?.remove();
    this._addressSuggestionContainer = null;
    this._activeIndex = -1;
    this._currentAddresses = [];
  }

  private _positionContainer(container: HTMLElement): void {
    const rect = this.input.getBoundingClientRect();
    container.style.top = `${rect.bottom + window.scrollY}px`;
    container.style.left = `${rect.left + window.scrollX}px`;
    container.style.width = `${rect.width}px`;
  }

  private _createAddressSuggestionContainer(): HTMLElement {
    const container = document.createElement('div');
    container.className = 'pac-container-nextcommerce pac-logo';
    container.style.cssText = 'display:none; position:absolute; z-index:9999';
    document.body.appendChild(container);
    container.addEventListener('mousedown', e => e.preventDefault());
    this._documentClickHandler = e => {
      if (!container.contains(e.target as Node) && e.target !== this.input) {
        container.style.display = 'none';
      }
    };
    document.addEventListener('click', this._documentClickHandler);
    return container;
  }

  private _buildHighlightedLabel(searchText: string, label: string): HTMLSpanElement {
    const span = document.createElement('span');
    span.className = 'pac-item-query';
    const words = searchText.split(/\s+/).filter(Boolean);
    if (!words.length) {
      span.textContent = label;
      return span;
    }
    const escaped = words.map(w => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
    const pattern = new RegExp(`(${escaped.join('|')})`, 'gi');
    span.append(...label.split(pattern).map(part =>
      words.some(w => w.toLowerCase() === part.toLowerCase())
        ? Object.assign(document.createElement('b'), { textContent: part })
        : document.createTextNode(part)
    ));
    return span;
  }

  private _createAddressSuggestionChoices(container: HTMLElement, searchText: string, data: AddressAutocompleteData): void {
    const addresses = data?.results ?? [];
    container.innerHTML = '';
    this._activeIndex = -1;
    this._currentAddresses = addresses;
    this._originalSearchText = this.input.value;

    addresses.forEach(addr => {
      const div = document.createElement('div');
      div.className = 'pac-item-nextcommerce';
      const icon = document.createElement('span');
      icon.className = 'pac-icon pac-icon-marker';
      div.appendChild(icon);
      div.appendChild(this._buildHighlightedLabel(searchText, addr.label));
      div.addEventListener('click', () => {
        this._originalSearchText = null;
        this.input.value = addr.label;
        this._fillAddress(addr);
        container.style.display = 'none';
      });
      container.appendChild(div);
    });

    container.appendChild(createCloseButton(() => {
      container.style.display = 'none';
    }));

    if (addresses.length) {
      this._positionContainer(container);
      container.style.display = 'block';
    } else {
      container.style.display = 'none';
    }
  }

  private _createAddressSuggestion(searchText: string, data: AddressAutocompleteData): void {
    if (!this._addressSuggestionContainer) {
      this._addressSuggestionContainer = this._createAddressSuggestionContainer();
    }
    this._createAddressSuggestionChoices(this._addressSuggestionContainer, searchText, data);
  }

  private async _getAddressSuggestionData(searchText: string): Promise<AddressAutocompleteData> {
    this._abortController?.abort();
    this._abortController = new AbortController();
    const data: AddressAutocompleteData = await this.apiClient.getAddressesAutocomplete(
      searchText, this._getCountryValue(), undefined, this._abortController.signal
    );
    this._lastData = data;
    this._lastSearchText = searchText;
    return data;
  }

  private _init(): void {
    let debounceTimer: ReturnType<typeof setTimeout>;

    this.input.addEventListener('keydown', e => {
      if (e.key === 'Enter') {
        e.preventDefault();
        const items = this._getAddressItems();
        if (this._activeIndex >= 0 && items[this._activeIndex]) {
          items[this._activeIndex].click();
        }
        return;
      }
      if (e.key === 'Escape') {
        this._tearDownAddressSuggestion();
        return;
      }
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault();
        this._keyNavigating = true;
        const isOpen = this._addressSuggestionContainer !== null &&
          this._addressSuggestionContainer.style.display !== 'none';
        if (!isOpen) return;
        const items = this._getAddressItems();
        if (!items.length) return;
        if (e.key === 'ArrowDown') {
          this._setActiveIndex(this._activeIndex >= items.length - 1 ? 0 : this._activeIndex + 1);
        } else {
          this._setActiveIndex(this._activeIndex <= 0 ? items.length - 1 : this._activeIndex - 1);
        }
        return;
      }
      this._keyNavigating = false;
    });

    this.input.addEventListener('focus', async () => {
      if (this._addressSuggestionContainer && this._lastData?.results?.length) {
        this._addressSuggestionContainer.style.display = 'block';
      } else if (this._lastData?.results?.length && this._lastSearchText) {
        this._createAddressSuggestion(this._lastSearchText, this._lastData);
      } else if (this._isValidSearchText(this.input.value)) {
        try {
          const data = await this._getAddressSuggestionData(this.input.value);
          this._tearDownAddressSuggestion();
          this._createAddressSuggestion(this.input.value, data);
        } catch (e) {
          if (e instanceof DOMException && e.name === 'AbortError') return;
          throw e;
        }
      }
    });

    this.input.addEventListener('blur', () => {
      if (!this._keyNavigating) this._tearDownAddressSuggestion();
      this._keyNavigating = false;
    });

    this.input.addEventListener('input', event => {
      if (this._keyNavigating) {
        this._keyNavigating = false;
        return;
      }
      this._originalSearchText = null;
      if (this._activeIndex >= 0) {
        this._getAddressItems().forEach(item => item.classList.remove('pac-item-nextcommerce--active'));
        this._activeIndex = -1;
      }
      const target = event.target as HTMLInputElement;
      if (!this._isValidSearchText(target.value)) {
        if (this._addressSuggestionContainer) {
          this._addressSuggestionContainer.style.display = 'none';
        }
        return;
      }
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(async () => {
        try {
          const data = await this._getAddressSuggestionData(target.value);
          this._tearDownAddressSuggestion();
          this._createAddressSuggestion(target.value, data);
        } catch (e) {
          if (e instanceof DOMException && e.name === 'AbortError') return;
          throw e;
        }
      }, 300);
    });
  }

  private async _fillAddress(place: AddressAutocompleteResult): Promise<void> {
    const { fields, billingFields, eventBus } = this.ctx;
    const isShipping = this.type === 'shipping';
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
        this._setStateWithRetry(stateField, state_code, state);
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
      const currentBillingData = checkoutStore.billingAddress ?? {
        first_name: '', last_name: '', address1: '', city: '', province: '', postal: '', country: '', phone: '',
      };
      checkoutStore.setBillingAddress({ ...currentBillingData, ...addressUpdates });
    }

    eventBus.emit('address:autocomplete-filled', { type: this.type, components: place });
  }

  private async _setStateWithRetry(
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
      this._setStateWithRetry(stateSelect, stateCode, stateName, attempt + 1);
    }
  }
}

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
      new AddressAutocomplete(addressField, this.ctx, this.apiClient, 'shipping', defaultCountry);
    }

    const billingAddressField = billingFields.get('billing-address1');
    if (billingAddressField instanceof HTMLInputElement) {
      new AddressAutocomplete(billingAddressField, this.ctx, this.apiClient, 'billing', defaultCountry);
    }
  }
}
