import { BaseEnhancer } from '@/core/base/base-enhancer';
import { useCheckoutStore } from '@/state/checkout';
import {
  addressLang,
  CountryService,
  type CountryRules,
} from '@/core/country-service';
import { optionalLabel } from '@/features/checkout/validation/field-messages';

import { builtInRules, fetchCountryRules } from './address-form.api';
import {
  contactLayout,
  readRenderedValues,
  renderLayout,
} from './address-form.renderer';

const FALLBACK_COUNTRY = 'US';

/** Each block's attributes, written out so a search finds them. */
const BLOCK_ATTRIBUTES = {
  address: {
    lang: 'data-next-address-lang',
    api: 'data-next-address-api',
    state: 'data-next-address-state',
  },
  contact: {
    lang: 'data-next-contact-lang',
    api: 'data-next-contact-api',
    state: 'data-next-contact-state',
  },
} as const;

const SHIPPING_BLOCK_SELECTOR =
  '[data-next-address]:not([data-next-address="billing"])';

/**
 * `data-next-address` and `data-next-contact`: the fields a country asks for, built from
 * its rules, the address rows or the name, email and phone rows. One enhancer for both,
 * because everything but which rows it builds is the same.
 */
export class AddressFormEnhancer extends BaseEnhancer {
  private block: 'address' | 'contact' = 'address';
  private form: 'shipping' | 'billing' = 'shipping';
  private lang?: string;
  private baseUrl?: string;
  private renderedCountry?: string;
  /** The country of the most recent render request, in flight or not. */
  private requestedCountry?: string;
  /** Only the newest request may render; a language switch keeps the country the same. */
  private requestId = 0;

  public async initialize(): Promise<void> {
    this.validateElement();
    this.readConfiguration();

    const country =
      useCheckoutStore.getState().formData.country || FALLBACK_COUNTRY;
    await this.renderCountry(country);

    // Compared against what was last *asked for*, not what is on screen. Going back to
    // the country already rendered, while a different one is still in flight, is a real
    // change of mind: judged against the screen it reads as "no change", the render never
    // starts, and the in-flight layout lands last and wins.
    this.subscribe(useCheckoutStore, state => {
      const next = state.formData.country;
      if (next && next !== this.requestedCountry) void this.renderCountry(next);
    });

    // The debug overlay's locale picker. It says so on `document`, not the bus.
    document.addEventListener('next:locale-changed', this.handleLocaleChange);
  }

  public override destroy(): void {
    super.destroy();
    document.removeEventListener(
      'next:locale-changed',
      this.handleLocaleChange
    );
  }

  private readonly handleLocaleChange = (): void => this.update();

  public update(): void {
    const country =
      useCheckoutStore.getState().formData.country || FALLBACK_COUNTRY;
    void this.renderCountry(country);
  }

  private readConfiguration(): void {
    this.block = this.element.hasAttribute('data-next-contact')
      ? 'contact'
      : 'address';
    // The contact rows are the customer's, which the order carries once.
    this.form =
      this.block === 'address' &&
      this.getAttribute('data-next-address') === 'billing'
        ? 'billing'
        : 'shipping';
    const attributes = BLOCK_ATTRIBUTES[this.block];
    this.lang = this.getAttribute(attributes.lang) ?? undefined;
    this.baseUrl = this.getAttribute(attributes.api) ?? undefined;
  }

  /**
   * Field names the surrounding form collects outside this block, which it does not build.
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

  /**
   * The rows this block builds. The contact rows' names and phone are part of an address
   * too: beside a shipping address the address builds them. Decided from the page's
   * blocks, not from which fields exist yet: judged by the fields, whichever block
   * answered first would keep them.
   */
  private layoutOf(rules: CountryRules): string[][] {
    if (this.block === 'address') return rules.address.layout;
    const besideShipping = Boolean(
      this.element.closest('form')?.querySelector(SHIPPING_BLOCK_SELECTOR)
    );
    return contactLayout(rules.address.layout, besideShipping);
  }

  /** Says where the block is, so a stylesheet can hold space for fields on their way. */
  private setState(state: 'loading' | 'ready'): void {
    this.element.setAttribute(BLOCK_ATTRIBUTES[this.block].state, state);
  }

  private resolveLang(): string {
    return addressLang(this.lang);
  }

  /**
   * A failure leaves what is on screen alone rather than emptying a half-typed form, and
   * renders the built-in layout when nothing is on screen yet.
   */
  private async renderCountry(countryCode: string): Promise<void> {
    this.requestedCountry = countryCode;
    const requestId = ++this.requestId;
    if (!this.renderedCountry) this.setState('loading');

    const lang = this.resolveLang();
    let rules: CountryRules;
    try {
      rules = await fetchCountryRules(countryCode, {
        ...(this.baseUrl ? { baseUrl: this.baseUrl } : {}),
        lang,
      });
    } catch (error) {
      this.logger.error(
        `Failed to load the address layout for ${countryCode}:`,
        error
      );
      if (requestId !== this.requestId) return;
      if (this.renderedCountry) {
        // Forget the request, so choosing this country again is a change and retries it.
        this.requestedCountry = this.renderedCountry;
        return;
      }
      rules = builtInRules(countryCode);
    }

    // A later country or language was asked for while this layout was in flight.
    // Rendering it now would leave the form showing what the shopper has already moved
    // off, and the change that would correct it has been and gone.
    if (requestId !== this.requestId) {
      this.logger.debug(
        `Discarding the ${countryCode} layout; a newer one was asked for since`
      );
      return;
    }

    const values = readRenderedValues(this.element);
    const fields = renderLayout(
      this.element,
      this.layoutOf(rules),
      rules.fields,
      {
        form: this.form,
        values,
        alreadyCollected: this.collectedElsewhere(),
        optionalLabel: label =>
          optionalLabel(
            CountryService.getInstance(),
            label,
            rules.lang ?? 'en'
          ),
      }
    );
    this.renderedCountry = countryCode;
    this.setState('ready');

    this.logger.debug(
      `Rendered ${fields.length} ${this.block} fields for ${countryCode}`,
      { fallbackLayout: rules.curated === false }
    );

    // The checkout form scanned before these existed, and binds listeners per field.
    this.emit('address:fields-rendered', {
      form: this.form,
      country: countryCode,
      fields,
    });
  }
}
