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
import { useCheckoutStore, type CheckoutState } from '@/state/checkout';

import { BILLING_CONTAINER_SELECTOR } from '../constants/selectors';

import {
  collapseBillingForm,
  expandBillingForm,
  type BillingAnimationContext,
} from './billing-animation';

/** Just enough delay to swallow a double-click, not enough to feel laggy. */
const DEBOUNCE_MS = 10;
/** Lets the expand animation start before the billing country is written into it. */
const POPULATE_DELAY_MS = 50;

/** The billing fields a shopper types: the country and province are picked from a list. */
const TYPED_BILLING_FIELDS = [
  'first_name',
  'last_name',
  'address1',
  'address2',
  'city',
  'postal',
  'phone',
] as const;

function hasTypedBillingAddress(
  address: CheckoutState['billingAddress']
): boolean {
  return TYPED_BILLING_FIELDS.some(key => (address?.[key] ?? '').trim() !== '');
}

/** What this module needs from the checkout form. */
export interface BillingToggleContext {
  /**
   * Takes every verdict off the billing fields and keeps their values. Ticked, nothing in
   * the section is checked or sent, so nothing in it is the shopper's to fix; unticked again
   * it comes back as typed, judged only when a field is left or the form submitted.
   */
  forgetBillingVerdicts: () => void;
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
      ctx.forgetBillingVerdicts();
      ctx.logger.info('[Billing] Collapsing form...');
      collapseBillingForm(ctx.animation, billingSection);
    } else {
      ctx.logger.info('[Billing] Expanding form...');
      expandBillingForm(ctx.animation, billingSection);

      // Seed the billing country from shipping, unless the shopper already typed a billing
      // address here, which stays as it is on screen and in the store. The address used
      // to be emptied in the store alone, so the fields still showed what was typed while
      // submit reported every one of them missing.
      setTimeout(() => {
        const { formData, billingAddress } = useCheckoutStore.getState();
        if (hasTypedBillingAddress(billingAddress)) return;

        const shippingCountry = formData.country;
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
      }, POPULATE_DELAY_MS);
    }
  }, DEBOUNCE_MS);
}
