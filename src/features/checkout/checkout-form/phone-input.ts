/**
 * International phone fields on the checkout form.
 *
 * `intl-tel-input` turns a plain `<input>` into a phone field that shows a flag, formats
 * as the shopper types, and — the part that matters for the order — yields a full E.164
 * number rather than whatever they typed. The shipping and billing phone fields each get
 * their own instance.
 *
 * Extracted from `checkout-form.enhancer.ts`, which is the first of several planned cuts
 * out of that file. It came out first because it is the least entangled: it needs seven
 * things from the form and nothing else, so it can be described by
 * {@link PhoneInputContext} instead of reaching into the enhancer.
 *
 * @see {@link https://github.com/jackocnr/intl-tel-input} for the underlying library.
 */

import intlTelInput from 'intl-tel-input';
import type { Iti } from 'intl-tel-input';

import type { Logger } from '@/core/logger';
import { useCheckoutStore } from '@/state/checkout';

import { normalizePhone } from '../validation/phone-validation';

/** Which of the two addresses a phone field belongs to. */
export type PhoneFieldType = 'shipping' | 'billing';

/**
 * The library's own country-code type, derived rather than imported: it is a ~240-member
 * union declared inside the package's namespace and not re-exported from the root, so
 * deriving is the only way to name it without hardcoding a copy that would go stale.
 *
 * Taken from `setCountry` specifically because that signature is the **narrower** of the
 * two used here — `initialCountry` additionally accepts `''` and `'auto'`. A value good
 * enough for `setCountry` is therefore good for both, whereas the reverse does not
 * type-check.
 */
type CountryCode = Parameters<Iti['setCountry']>[0];

/**
 * Asserts a country string is one the library knows.
 *
 * The codes come from a `<select>` the page author populates and from geo detection, so
 * neither is provably a member of that union at compile time. This is the one place that
 * assertion is made — previously it was two scattered `as any` casts, which also silenced
 * the checks on everything else in those calls. An unknown code makes the library fall
 * back to no initial country rather than throw.
 */
function asCountryCode(code: string): CountryCode {
  return code as CountryCode;
}

/**
 * What this module needs from the checkout form.
 *
 * Passed rather than imported so these functions can be tested against a plain object,
 * and so the coupling to the enhancer is exactly this list rather than "all of it".
 * Mirrors the `UpsellHandlerContext` pattern used by `features/cart/accept-upsell`.
 */
export interface PhoneInputContext {
  /**
   * False when the library did not load, in which case the fields stay ordinary text
   * inputs and no formatting happens.
   */
  isIntlTelInputAvailable: boolean;
  /** Shipping fields, keyed by their `data-next-checkout-field` name. */
  fields: Map<string, HTMLElement>;
  /** Billing fields, keyed the same way with a `billing-` prefix. */
  billingFields: Map<string, HTMLElement>;
  /**
   * Live instances, keyed by {@link PhoneFieldType}. Held by the caller because the form
   * also destroys them on teardown, and re-initialising must replace rather than stack.
   *
   * Destroying one also removes the `input` and `change` listeners this module put on
   * the form's own markup — see {@link initializePhoneInputs}. Dropping an instance
   * without calling `destroy()` therefore leaks both.
   */
  phoneInputs: Map<string, Iti>;
  /** Country to start a field on when its country `<select>` has no value yet. */
  detectedCountryCode: string;
  /**
   * Writes the resolved international number back to the checkout form state.
   *
   * Narrowed to string values rather than mirroring the form's own
   * `Record<string, any>`: the only thing this module ever writes is a phone number, and
   * the narrower type is what a fake in a test has to satisfy.
   */
  updateFormData: (data: Record<string, string>) => void;
  logger: Logger;
}

/** Element id of the injected stylesheet, so injection stays idempotent. */
const STYLE_ID = 'intl-tel-input-paths';

/**
 * Points `intl-tel-input` at its flag and globe images.
 *
 * The library loads these through CSS custom properties rather than bundling them, so
 * without this the fields render with missing images. The CDN path is deliberately
 * **unversioned**: the images do not change between SDK releases, so a shared path lets a
 * returning visitor reuse a cached copy instead of refetching per version.
 *
 * Idempotent — safe to call on every boot.
 */
export function injectIntlTelInputStyles(): void {
  if (document.getElementById(STYLE_ID)) return;

  // Debug mode means the dev server is serving the SDK, so the images are local too.
  const isDebug =
    new URLSearchParams(window.location.search).get('debug') === 'true';
  const baseUrl = isDebug
    ? 'http://localhost:3000'
    : 'https://cdn.jsdelivr.net/gh/NextCommerceCo/campaign-cart/dist';

  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = `
      .iti {
        --iti-path-flags-1x: url('${baseUrl}/intl-tel-input/img/flags.webp');
        --iti-path-flags-2x: url('${baseUrl}/intl-tel-input/img/flags@2x.webp');
        --iti-path-globe-1x: url('${baseUrl}/intl-tel-input/img/globe.webp');
        --iti-path-globe-2x: url('${baseUrl}/intl-tel-input/img/globe@2x.webp');
      }
    `;
  document.head.appendChild(style);
}

/** The country `<select>` paired with a phone field, when the form has one. */
function countryFieldFor(
  ctx: PhoneInputContext,
  type: PhoneFieldType
): HTMLElement | undefined {
  return type === 'shipping'
    ? ctx.fields.get('country')
    : ctx.billingFields.get('billing-country');
}

/**
 * Turns one phone field into an international one.
 *
 * Failure is contained: if the library throws, the error is logged and the field is left
 * as a plain input rather than taking the form down with it. That is why a broken phone
 * field shows up as a log line and a shopper who can still check out.
 */
function initializePhoneInput(
  ctx: PhoneInputContext,
  type: PhoneFieldType,
  phoneField: HTMLInputElement
): void {
  try {
    // Re-initialising must replace, not stack: a second instance on the same element
    // would double every input listener and reformat what the first one wrote.
    ctx.phoneInputs.get(type)?.destroy();

    const countryField = countryFieldFor(ctx, type);
    const initialCountry =
      countryField instanceof HTMLSelectElement && countryField.value
        ? countryField.value.toLowerCase()
        : ctx.detectedCountryCode.toLowerCase();

    // The library's own `autoPlaceholder` is off, so the required marker has to be
    // written here or the field would show an example number instead.
    const isRequired =
      phoneField.getAttribute('data-next-required') === 'true' ||
      phoneField.hasAttribute('required');
    phoneField.placeholder = isRequired ? 'Phone*' : 'Phone (Optional)';

    const instance = intlTelInput(phoneField, {
      separateDialCode: false,
      nationalMode: true,
      autoPlaceholder: 'off',
      loadUtils: () => import('intl-tel-input/utils'),
      // The library's default is `["MOBILE"]`, which makes *both* of its validation
      // methods answer "is this a valid mobile number" rather than "is this a valid
      // number". In countries where a landline is not the same length as a mobile, that
      // rejects a shopper who gave a landline. `null` turns the type filter off.
      validationNumberTypes: null,
      countryOrder: ['us', 'ca', 'gb', 'au'],
      allowDropdown: false,
      showFlags: true,
      initialCountry: asCountryCode(initialCountry),
      formatOnDisplay: true,
    });

    // The library adds padding to make room for a dropdown arrow it is not showing.
    phoneField.style.removeProperty('padding-left');

    ctx.phoneInputs.set(type, instance);

    // Both listeners below sit on the page author's markup, and the only handle the
    // caller keeps is this `Iti` instance — so the listeners have to come off when it
    // is destroyed, which is the call both teardown paths already make (the
    // replace-on-re-init above, and the form's own loop over `phoneInputs`). Without
    // this they outlived the form and a re-init stacked another pair on the same field.
    const listenerAbort = new AbortController();
    const destroyInstance = instance.destroy.bind(instance);
    instance.destroy = () => {
      listenerAbort.abort();
      destroyInstance();
    };

    // Store the full international number, not the national text the shopper sees —
    // the order needs E.164. `normalizePhone` rather than `getNumber()` because the
    // latter returns `''` until the utils script has loaded, and writing that would blank
    // a phone the shopper has already typed.
    phoneField.addEventListener(
      'input',
      () => {
        const fullNumber = normalizePhone(phoneField.value, instance);
        if (type === 'shipping') {
          ctx.updateFormData({ phone: fullNumber });
          return;
        }
        const checkoutStore = useCheckoutStore.getState();
        const currentBillingData = checkoutStore.billingAddress ?? {
          first_name: '',
          last_name: '',
          address1: '',
          city: '',
          province: '',
          postal: '',
          country: '',
          phone: '',
        };
        checkoutStore.setBillingAddress({
          ...currentBillingData,
          phone: fullNumber,
        });
      },
      { signal: listenerAbort.signal }
    );

    // Changing the address country re-bases the phone country, so a shopper who
    // switches country does not keep the previous dial code.
    //
    // Except when the shopper wrote the number internationally. `setCountry` keeps the
    // national digits and swaps the dial code in front of them, which turns a stated
    // `+66 81 234 5678` into `+1 81 234 5678` — a number that is not theirs, is not valid,
    // and is what the field then shows them. A number carrying its own country code has
    // already said which country it belongs to, and the address country is a different
    // question: someone shipping to the US may well be reachable on a Thai phone.
    if (countryField instanceof HTMLSelectElement) {
      countryField.addEventListener(
        'change',
        () => {
          const countryCode = countryField.value;
          if (!countryCode) return;
          if (phoneField.value.trim().startsWith('+')) return;
          instance.setCountry(asCountryCode(countryCode.toLowerCase()));
        },
        { signal: listenerAbort.signal }
      );
    }
  } catch (error) {
    ctx.logger.error(`Failed to initialize ${type} phone field:`, error);
  }
}

/**
 * Initialises both phone fields, where they exist and the library is available.
 *
 * Called on boot and again after the billing form is revealed, since the billing phone
 * field may not have been in the DOM the first time.
 */
/**
 * How long a submit waits for the phone library's utils script before going ahead anyway.
 *
 * Two seconds is long enough for the chunk on any connection that can also reach the
 * orders API, and short enough that a shopper whose network dropped it entirely is not
 * left staring at a spinner. The wait happens under the loading overlay, so in the normal
 * case — the chunk arrived seconds ago, during typing — it costs nothing and shows nothing.
 */
const UTILS_WAIT_MS = 2000;

/**
 * Waits for `intl-tel-input` to finish loading the utils script it validates and formats
 * with, and reports whether it arrived.
 *
 * Everything the SDK wants from that library needs this script: `getNumber()` returns `''`
 * without it and `isValidNumber()` returns `null`. Both degrade quietly, so a submit that
 * races the chunk stores a national number and skips the check without anything looking
 * wrong. Calling this first turns that race into a wait.
 *
 * Resolving `false` means the wait ran out, not that anything failed — the caller carries
 * on and the number is handled as {@link checkPhone}'s `unknown`, which never blocks a
 * shopper for a problem that is ours.
 *
 * @example
 * ```ts
 * await awaitPhoneUtils(this.phoneInputs);
 * const validation = await this.validator.validateForm(formData, countryConfigs);
 * ```
 */
export async function awaitPhoneUtils(
  phoneInputs: Map<string, Iti>,
  timeoutMs: number = UTILS_WAIT_MS
): Promise<boolean> {
  const pending = [...phoneInputs.values()].map(instance => instance.promise);
  if (pending.length === 0) return false;

  let timer: ReturnType<typeof setTimeout> | undefined;
  const expiry = new Promise<false>(resolve => {
    timer = setTimeout(() => resolve(false), timeoutMs);
  });

  try {
    const settled = await Promise.race([
      Promise.all(pending).then(() => true),
      expiry,
    ]);
    return settled;
  } catch {
    // A rejected init promise is the geo-IP lookup or the chunk failing. Both are already
    // logged by the library, and both mean the same thing here: carry on without it.
    return false;
  } finally {
    if (timer) clearTimeout(timer);
  }
}

export function initializePhoneInputs(ctx: PhoneInputContext): void {
  if (!ctx.isIntlTelInputAvailable) return;

  const shippingPhoneField = ctx.fields.get('phone');
  if (shippingPhoneField instanceof HTMLInputElement) {
    initializePhoneInput(ctx, 'shipping', shippingPhoneField);
  }

  const billingPhoneField = ctx.billingFields.get('billing-phone');
  if (billingPhoneField instanceof HTMLInputElement) {
    initializePhoneInput(ctx, 'billing', billingPhoneField);
  }
}
