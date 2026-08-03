/**
 * The "use a different billing address" checkbox — what happens between the shopper
 * ticking it and the billing section being open or shut.
 *
 * The animation itself lives in [`billing-animation.ts`](./billing-animation.ts); this is
 * the decision layer above it, and it does four things in order:
 *
 * 1. **Refuses a click that lands mid-animation**, putting the checkbox back where it was.
 *    Without that a fast second click starts a second animation over the first, and the
 *    section settles on whichever finishes last rather than on what the box says.
 * 2. **Waits 10 ms** — long enough to swallow a double-click, short enough that a real
 *    click still feels immediate.
 * 3. **Writes the choice to the checkout store**, which is what the order is built from.
 *    The store, not the checkbox, is the answer to "is billing the same as shipping?".
 * 4. **Opens or closes the section**, and when opening, seeds the billing country from the
 *    shipping country so the province dropdown has something to load.
 *
 * Opening deliberately **empties** the rest of the billing address in the store. A shopper
 * who ticks "different billing address" is saying the shipping address is wrong for
 * billing, so anything left over from a previous tick would be a silently wrong address on
 * the order.
 *
 * Extracted from `checkout-form.enhancer.ts` verbatim. It needs five things from the form
 * ({@link BillingToggleContext}).
 */

import type { Logger } from '@/core/logger';
import { useCheckoutStore } from '@/state/checkout';

import {
  collapseBillingForm,
  expandBillingForm,
  type BillingAnimationContext,
} from './billing-animation';

/**
 * The billing section, in both attribute spellings.
 *
 * Deliberately **not** the `BILLING_CONTAINER_SELECTOR` exported by
 * `checkout/constants/selectors.ts`: that one is the legacy `os-checkout-element` half
 * only, so using it here would stop this toggle finding a section written with
 * `data-next-component`.
 */
const BILLING_CONTAINER_SELECTOR =
  '[os-checkout-element="different-billing-address"], [data-next-component="different-billing-address"]';

/** Just enough delay to swallow a double-click, not enough to feel laggy. */
const DEBOUNCE_MS = 10;
/** Lets the expand animation start before the billing country is written into it. */
const POPULATE_DELAY_MS = 50;

/** What this module needs from the checkout form. */
export interface BillingToggleContext {
  /**
   * True while an expand/collapse is running — the same ref `billing-animation.ts` holds,
   * so the guard here and the animation there read one flag rather than two copies.
   */
  animationInProgress: { value: boolean };
  /**
   * The pending debounce timer, held by the form so `destroy()` can clear it. A ref for
   * the same reason as {@link BillingToggleContext.animationInProgress}: both this module
   * and the form's teardown write it.
   */
  debounceTimer: { value?: NodeJS.Timeout };
  /** What the animation module needs — see {@link BillingAnimationContext}. */
  animation: BillingAnimationContext;
  /** The cloned billing inputs, keyed `billing-country`, `billing-city`, … */
  billingFields: Map<string, HTMLElement>;
  logger: Logger;
}

/**
 * Handles a `change` on `input[name="use_shipping_address"]`.
 *
 * The checkbox reads "use the shipping address for billing", so **checked collapses** the
 * billing section and unchecked opens it.
 *
 * @example
 * ```ts
 * const toggle = form.querySelector('input[name="use_shipping_address"]');
 * toggle?.addEventListener('change', event =>
 *   handleBillingAddressToggle(this.billingToggleContext(), event)
 * );
 * ```
 */
export function handleBillingAddressToggle(
  ctx: BillingToggleContext,
  event: Event
): void {
  const target = event.target as HTMLInputElement;

  ctx.logger.info('[Billing] Toggle clicked', {
    checked: target.checked,
    animationInProgress: ctx.animationInProgress.value,
  });

  // Prevent rapid clicks during animation
  if (ctx.animationInProgress.value) {
    event.preventDefault();
    // Revert checkbox state
    target.checked = !target.checked;
    ctx.logger.warn('[Billing] Click blocked - animation in progress');
    return;
  }

  // Clear any existing debounce timer
  if (ctx.debounceTimer.value) {
    clearTimeout(ctx.debounceTimer.value);
  }

  // Reduced debounce to 10ms (just enough to prevent double-clicks)
  ctx.debounceTimer.value = setTimeout(() => {
    const checkoutStore = useCheckoutStore.getState();
    const billingSection = document.querySelector(BILLING_CONTAINER_SELECTOR);

    if (!billingSection || !(billingSection instanceof HTMLElement)) {
      ctx.logger.error('[Billing] CRITICAL: Billing section not found!');
      return;
    }

    ctx.logger.info('[Billing] Processing toggle', {
      targetChecked: target.checked,
      currentHeight: billingSection.style.height,
      currentOverflow: billingSection.style.overflow,
      currentTransition: billingSection.style.transition,
      classes: billingSection.className,
    });

    // Update store state
    checkoutStore.setSameAsShipping(target.checked);

    if (target.checked) {
      ctx.logger.info('[Billing] Collapsing form...');
      collapseBillingForm(ctx.animation, billingSection);
    } else {
      ctx.logger.info('[Billing] Expanding form...');
      expandBillingForm(ctx.animation, billingSection);

      // Populate billing fields after expansion
      setTimeout(() => {
        // Only set the country and trigger state loading
        const shippingCountry = checkoutStore.formData.country;
        const billingCountryField = ctx.billingFields.get('billing-country');

        if (
          shippingCountry &&
          billingCountryField instanceof HTMLSelectElement
        ) {
          billingCountryField.value = shippingCountry;
          billingCountryField.dispatchEvent(
            new Event('change', { bubbles: true })
          );
          ctx.logger.debug('[Billing] Set country to:', shippingCountry);
        }

        // Clear the billing address in the store (except country)
        checkoutStore.setBillingAddress({
          first_name: '',
          last_name: '',
          address1: '',
          address2: '',
          city: '',
          province: '',
          postal: '',
          country: shippingCountry || '',
          phone: '',
        });
      }, POPULATE_DELAY_MS);
    }
  }, DEBOUNCE_MS);
}
