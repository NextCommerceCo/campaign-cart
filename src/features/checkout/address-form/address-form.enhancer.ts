import { BaseEnhancer } from '@/core/base/base-enhancer';
import { useCheckoutStore } from '@/state/checkout';

import { fetchAddressSpec, type AddressSpec } from './address-form.api';
import { readRenderedValues, renderAddressSpec } from './address-form.renderer';

const FALLBACK_COUNTRY = 'US';

export class AddressFormEnhancer extends BaseEnhancer {
  private form: 'shipping' | 'billing' = 'shipping';
  private lang?: string;
  private baseUrl?: string;
  private renderedCountry?: string;

  public async initialize(): Promise<void> {
    this.validateElement();
    this.readConfiguration();

    const country =
      useCheckoutStore.getState().formData.country || FALLBACK_COUNTRY;
    await this.renderCountry(country);

    this.subscribe(useCheckoutStore, state => {
      const next = state.formData.country;
      if (next && next !== this.renderedCountry) void this.renderCountry(next);
    });
  }

  public update(): void {
    const country =
      useCheckoutStore.getState().formData.country || FALLBACK_COUNTRY;
    void this.renderCountry(country);
  }

  private readConfiguration(): void {
    this.form =
      this.getAttribute('data-next-address') === 'billing' ? 'billing' : 'shipping';
    this.lang = this.getAttribute('data-next-address-lang') ?? undefined;
    this.baseUrl = this.getAttribute('data-next-address-api') ?? undefined;
  }

  /**
   * Field names the surrounding form already collects outside this block.
   *
   * Read fresh on every render: a country change replaces this block's own inputs, and
   * those must never count as already collected or the block would empty itself.
   */
  private collectedElsewhere(): ReadonlySet<string> {
    const form = this.element.closest('form');
    if (!form) return new Set();

    const names = new Set<string>();
    form
      .querySelectorAll<HTMLElement>('[data-next-checkout-field]')
      .forEach(field => {
        if (this.element.contains(field)) return;
        const name = field.getAttribute('data-next-checkout-field');
        if (name) names.add(name);
      });
    return names;
  }

  /** A failure leaves what is on screen alone rather than emptying a half-typed form. */
  private async renderCountry(countryCode: string): Promise<void> {
    let spec: AddressSpec;
    try {
      spec = await fetchAddressSpec(countryCode, {
        ...(this.baseUrl ? { baseUrl: this.baseUrl } : {}),
        ...(this.lang ? { lang: this.lang } : {}),
      });
    } catch (error) {
      this.logger.error(`Failed to load the address layout for ${countryCode}:`, error);
      return;
    }

    const values = readRenderedValues(this.element);
    const fields = renderAddressSpec(this.element, spec, {
      form: this.form,
      values,
      alreadyCollected: this.collectedElsewhere(),
    });
    this.renderedCountry = countryCode;

    this.logger.debug(
      `Rendered ${fields.length} address fields for ${countryCode}`,
      { fallbackLayout: Boolean(spec.fallback) }
    );

    // The checkout form scanned before these existed, and binds listeners per field.
    this.emit('address:fields-rendered', {
      form: this.form,
      country: countryCode,
      fields,
    });
  }
}
