/**
 * Showing and hiding the fields that belong to each payment method.
 *
 * A checkout offers several ways to pay, each wrapped in a
 * `[data-next-payment-method]` element holding a radio and a `[data-next-payment-form]`.
 * Only the chosen method's form is open; the rest are collapsed to zero height, which
 * keeps their inputs out of the tab order and their stale validation errors off screen.
 *
 * Two entry points, and the difference between them matters:
 *
 * - {@link initializePaymentForms} runs once at startup and **snaps** each form to its
 *   state with no animation, matching whatever the checkout store already says. It reads
 *   the store because a shopper returning to the page must find the method they picked
 *   still selected.
 * - {@link updatePaymentFormVisibility} runs when the shopper picks a different method and
 *   **animates** the swap. It reads the radio values, not the store.
 *
 * The markup spellings (`credit`, `apple-pay`) are not the names the store and API use
 * (`credit-card`, `apple_pay`), so the startup pass translates both sides through
 * `toCheckoutPaymentMethod` — the same table the radio handler reads — rather than
 * comparing the two vocabularies directly. The update pass needs no translation at all: it
 * is matching one radio value against another.
 *
 * Extracted verbatim from `ui-service.ts`. It needs three things from the service
 * ({@link PaymentFormDisplayContext}) and calls none of its methods.
 */

import type { Logger } from '@/core/logger';
import { useCheckoutStore } from '@/state/checkout';

import { toCheckoutPaymentMethod } from '../../constants/field-mappings';
import type { ErrorDisplayManager } from '../../utils/error-display-utils';

/** What this module needs from `UIService`. */
export interface PaymentFormDisplayContext {
  /** The checkout form. Payment method wrappers are looked up inside it. */
  form: HTMLFormElement;
  /** Clears the error labels and icons a collapsed form leaves behind. */
  errors: ErrorDisplayManager;
  logger: Logger;
}

/**
 * Puts every payment form into the state the checkout store implies, without animating.
 *
 * Runs at startup, so there is nothing to animate *from* — a transition here would show
 * the card fields sliding shut on a page that has only just appeared.
 */
export function initializePaymentForms(ctx: PaymentFormDisplayContext): void {
  ctx.logger.debug('Initializing payment forms');

  // Get the payment method from checkout store
  const checkoutStore = useCheckoutStore.getState();
  const storePaymentMethod = checkoutStore.paymentMethod;

  ctx.logger.debug('Payment method from store:', storePaymentMethod);

  const paymentMethods = ctx.form.querySelectorAll(
    '[data-next-payment-method]'
  );

  paymentMethods.forEach(paymentMethodElement => {
    if (paymentMethodElement instanceof HTMLElement) {
      const methodType = paymentMethodElement.getAttribute(
        'data-next-payment-method'
      );
      const radio = paymentMethodElement.querySelector('input[type="radio"]');
      const paymentForm = paymentMethodElement.querySelector(
        '[data-next-payment-form]'
      );

      if (
        !(radio instanceof HTMLInputElement) ||
        !(paymentForm instanceof HTMLElement)
      ) {
        return;
      }

      // The markup's word for this method and the store's are read through the
      // same table, so `credit` and `card_token` land on one value and match.
      const offeredMethod = toCheckoutPaymentMethod(methodType);
      const shouldBeSelected =
        !!offeredMethod &&
        offeredMethod === toCheckoutPaymentMethod(storePaymentMethod);

      // Sync radio button state with store
      radio.checked = !!shouldBeSelected;

      // Sync the visual state
      if (shouldBeSelected) {
        // Ensure it's properly expanded
        paymentMethodElement.classList.add('next-selected');
        paymentForm.setAttribute('data-next-payment-state', 'expanded');
        paymentForm.classList.add('payment-method__form--expanded');
        paymentForm.classList.remove('payment-method__form--collapsed');
        paymentForm.classList.remove('payment-method__form--collapsing');
        paymentForm.classList.remove('payment-method__form--expanding');
        paymentForm.style.height = '';
        paymentForm.style.overflow = '';
        paymentForm.style.transition = '';

        ctx.logger.debug(
          `Expanded payment method: ${methodType} (store: ${storePaymentMethod})`
        );
      } else {
        // Ensure it's properly collapsed
        paymentMethodElement.classList.remove('next-selected');
        paymentForm.setAttribute('data-next-payment-state', 'collapsed');
        paymentForm.classList.add('payment-method__form--collapsed');
        paymentForm.classList.remove('payment-method__form--expanded');
        paymentForm.classList.remove('payment-method__form--expanding');
        paymentForm.classList.remove('payment-method__form--collapsing');
        paymentForm.style.height = '0px';
        paymentForm.style.overflow = 'hidden';
        paymentForm.style.transition = '';

        ctx.logger.debug(`Collapsed payment method: ${methodType}`);
      }
    }
  });
}

/**
 * Animates the swap when the shopper chooses a different way to pay.
 *
 * Errors are cleared from **both** sides: from the form being collapsed, so a hidden
 * field cannot hold an error nobody can see, and from the one being revealed, so a method
 * the shopper has come back to does not open pre-marked as wrong.
 *
 * @param paymentMethod The chosen radio's `value`.
 */
export function updatePaymentFormVisibility(
  ctx: PaymentFormDisplayContext,
  paymentMethod: string
): void {
  ctx.logger.debug(
    'Updating payment form visibility for method:',
    paymentMethod
  );

  // Handle payment method forms using data attributes (preferred approach)
  const paymentMethods = ctx.form.querySelectorAll(
    '[data-next-payment-method]'
  );

  paymentMethods.forEach(paymentMethodElement => {
    if (paymentMethodElement instanceof HTMLElement) {
      const radio = paymentMethodElement.querySelector('input[type="radio"]');
      const paymentForm = paymentMethodElement.querySelector(
        '[data-next-payment-form]'
      );

      if (
        !(radio instanceof HTMLInputElement) ||
        !(paymentForm instanceof HTMLElement)
      ) {
        return; // Use return instead of continue in forEach
      }

      if (radio && paymentForm) {
        const isSelected = radio.value === paymentMethod;

        ctx.logger.debug(
          `Payment method ${radio.value}: ${isSelected ? 'selected' : 'not selected'}`
        );

        if (isSelected) {
          // Add next-selected class to the payment method container
          paymentMethodElement.classList.add('next-selected');

          // Set data attribute for expanded state
          paymentForm.setAttribute('data-next-payment-state', 'expanded');

          // Smooth expand animation
          expandPaymentForm(ctx, paymentForm);

          // Clear any existing errors when switching payment methods
          clearPaymentFormErrors(ctx, paymentForm);
        } else {
          // Remove next-selected class from non-selected payment methods
          paymentMethodElement.classList.remove('next-selected');

          // Set data attribute for collapsed state
          paymentForm.setAttribute('data-next-payment-state', 'collapsed');

          // Smooth collapse animation
          collapsePaymentForm(ctx, paymentForm);

          // Clear errors from collapsed forms
          clearPaymentFormErrors(ctx, paymentForm);
        }
      }
    }
  });
}

/**
 * Opens a payment form, animating from zero to its natural height.
 *
 * `height` cannot transition to `auto`, so the target is measured at `auto` first, pinned
 * as a pixel value, and cleared once the transition has run.
 */
function expandPaymentForm(
  ctx: PaymentFormDisplayContext,
  paymentForm: HTMLElement
): void {
  // Check if already expanded to avoid duplicate animations
  if (paymentForm.classList.contains('payment-method__form--expanded')) {
    return;
  }

  // Ensure overflow is hidden for animation
  paymentForm.style.overflow = 'hidden';

  // Get current height (should be 0 from collapsed state)
  const startHeight = paymentForm.offsetHeight;

  // Remove collapsed class and add expanding class for animation
  paymentForm.classList.remove('payment-method__form--collapsed');
  paymentForm.classList.add('payment-method__form--expanding');

  // Calculate target height
  paymentForm.style.height = 'auto';
  const targetHeight = paymentForm.scrollHeight;

  // Reset to start height
  paymentForm.style.height = startHeight + 'px';

  // Force a reflow to ensure browser registers the starting state
  void paymentForm.offsetHeight;

  // Use requestAnimationFrame to ensure smooth animation in production
  requestAnimationFrame(() => {
    // Set transition
    paymentForm.style.transition = 'height 0.3s cubic-bezier(0.4, 0, 0.2, 1)';

    // Animate to target height
    paymentForm.style.height = targetHeight + 'px';

    // Clean up after animation completes
    setTimeout(() => {
      paymentForm.classList.remove('payment-method__form--expanding');
      paymentForm.classList.add('payment-method__form--expanded');
      paymentForm.style.height = '';
      paymentForm.style.transition = '';
      paymentForm.style.overflow = '';
    }, 300); // Match transition duration
  });

  ctx.logger.debug('Expanded payment form');
}

/**
 * Closes a payment form, animating from its current height to zero.
 *
 * Stays pinned at zero afterwards, unlike expand — there is nothing for a closed form to
 * grow into.
 */
function collapsePaymentForm(
  ctx: PaymentFormDisplayContext,
  paymentForm: HTMLElement
): void {
  // Check if already collapsed to avoid duplicate animations
  if (paymentForm.classList.contains('payment-method__form--collapsed')) {
    return;
  }

  // Ensure overflow is hidden for animation
  paymentForm.style.overflow = 'hidden';

  // Get current height for animation
  const currentHeight = paymentForm.scrollHeight;

  // Remove expanded class and add collapsing class for animation
  paymentForm.classList.remove('payment-method__form--expanded');
  paymentForm.classList.add('payment-method__form--collapsing');

  // Set explicit height for starting point
  paymentForm.style.height = currentHeight + 'px';

  // Force a reflow to ensure browser registers the starting state
  void paymentForm.offsetHeight;

  // Use requestAnimationFrame to ensure smooth animation in production
  requestAnimationFrame(() => {
    // Set transition
    paymentForm.style.transition = 'height 0.3s cubic-bezier(0.4, 0, 0.2, 1)';

    // Animate to 0 height
    paymentForm.style.height = '0px';

    // Clean up after animation completes
    setTimeout(() => {
      paymentForm.classList.remove('payment-method__form--collapsing');
      paymentForm.classList.add('payment-method__form--collapsed');
      paymentForm.style.transition = '';
    }, 300); // Match transition duration
  });

  ctx.logger.debug('Collapsed payment form');
}

/**
 * Strips every validation mark from one payment form.
 *
 * Clears the tick as well as the error, because a green tick on a field the shopper has
 * not looked at since switching methods is a claim the form has not re-checked.
 */
function clearPaymentFormErrors(
  ctx: PaymentFormDisplayContext,
  paymentForm: HTMLElement
): void {
  // Use error manager to clear all errors in the payment form
  ctx.errors.clearAllErrors(paymentForm);

  // Remove validation classes from fields when clearing errors
  // Don't add 'no-error' to empty fields - that should only happen after successful validation
  const fields = paymentForm.querySelectorAll('input, select, textarea');
  fields.forEach(field => {
    field.classList.remove('no-error', 'has-error', 'next-error-field');
    // Also remove validation icon classes from parent elements
    const formGroup = field.closest('.form-group');
    if (formGroup) {
      formGroup.classList.remove('addTick', 'addErrorIcon', 'has-error');
    }
    const formInput = field.closest('.form-input');
    if (formInput) {
      formInput.classList.remove('addTick', 'addErrorIcon');
    }
  });

  ctx.logger.debug('Cleared payment form errors');
}
