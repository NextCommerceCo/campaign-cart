/**
 * Renders the address fields a country actually collects, in the order it writes them.
 *
 * A checkout page marks an empty container `data-next-address="shipping"` and this builds
 * the inputs inside it. Japan leads with the postcode and collects no second name line;
 * Germany collects no state at all; the US puts city, state and ZIP on one row. Every
 * input it writes carries `data-next-checkout-field`, so `CheckoutFormEnhancer` reads them
 * exactly as it reads hand-written ones — this feature decides *which fields and in what
 * order*, and nothing else.
 *
 * It is **opt-in and additive**. A page that writes its own address fields is untouched;
 * both styles work, and nothing about the existing checkout form changed to allow it.
 */

import { BaseEnhancer } from '@/core/base/base-enhancer';
import { useCheckoutStore } from '@/state/checkout';

import { fetchAddressSpec, type AddressSpec } from './address-form.api';
import {
  readRenderedValues,
  renderAddressSpec,
} from './address-form.renderer';

/** The country a block opens on before the checkout form has resolved one. */
const FALLBACK_COUNTRY = 'US';

export class AddressFormEnhancer extends BaseEnhancer {
  private form: 'shipping' | 'billing' = 'shipping';
  private lang?: string;
  private baseUrl?: string;
  /** The country the rendered block belongs to, so a repeat store write re-renders nothing. */
  private renderedCountry?: string;

  public async initialize(): Promise<void> {
    this.validateElement();
    this.readConfiguration();

    const country =
      useCheckoutStore.getState().formData.country || FALLBACK_COUNTRY;
    await this.renderCountry(country);

    // `this.subscribe` records the unsubscribe that `destroy()` runs; `store.subscribe`
    // would outlive the element.
    this.subscribe(useCheckoutStore, state => {
      const next = state.formData.country;
      if (next && next !== this.renderedCountry) void this.renderCountry(next);
    });

    this.logger.debug(`Address form initialized for ${this.form}`);
  }

  public update(): void {
    const country =
      useCheckoutStore.getState().formData.country || FALLBACK_COUNTRY;
    void this.renderCountry(country);
  }

  /**
   * `billing` is accepted but left to the checkout form, which builds its billing address
   * by cloning the shipping one (`billing-form-setup.ts`). Rendering a second billing form
   * here would give the page two sets of `billing-*` fields and no answer for which the
   * order is built from.
   */
  private readConfiguration(): void {
    const requested = this.getAttribute('data-next-address') || 'shipping';
    if (requested === 'billing') {
      this.logger.warn(
        'data-next-address="billing" is not rendered yet; the checkout form clones the billing address from the shipping one'
      );
    }
    this.form = 'shipping';
    this.lang = this.getAttribute('data-next-address-lang') ?? undefined;
    this.baseUrl = this.getAttribute('data-next-address-api') ?? undefined;
  }

  /**
   * Fetches a country's layout and rebuilds the block from it.
   *
   * A failure leaves whatever is on screen alone rather than emptying the container: a
   * shopper part-way through an address must not lose it because a layout request timed
   * out, and on a first render an empty block is better than a broken one — the page can
   * still carry its own fields.
   */
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
    });
    this.renderedCountry = countryCode;

    this.logger.debug(
      `Rendered ${fields.length} address fields for ${countryCode}`,
      { fallbackLayout: Boolean(spec.fallback) }
    );

    // The checkout form scans for its fields once at boot. These did not exist then, so
    // it is told to look again — that is the whole integration.
    this.emit('address:fields-rendered', {
      form: this.form,
      country: countryCode,
      fields,
    });
  }
}
