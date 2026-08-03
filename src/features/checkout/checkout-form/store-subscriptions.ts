/**
 * What the checkout form does when state changes underneath it, rather than because the
 * shopper touched something.
 *
 * The form subscribes to three stores, and each one answers a different question:
 *
 * - **checkout** — the shopper's own data. Errors written by anything other than this form
 *   (express checkout, a server response) are handed to the validator so they appear on the
 *   fields; an address that arrived from autocomplete reveals the city/state/postcode rows;
 *   and `isProcessing` is what disables the submit button, so one order cannot be placed
 *   twice.
 * - **cart** — an empty cart is a checkout that cannot complete, so it is logged.
 * - **config** — the Spreedly key can arrive *after* boot (the config is fetched), in which
 *   case the card fields have to be built late. This is the only path that does that.
 *
 * **Errors are never cleared wholesale here.** A checkout state with no errors is not the
 * same as every field being correct — it is usually a field the shopper has not reached
 * yet. Clearing on an empty error map would tick every box on the form. Errors are cleared
 * one field at a time as each is fixed, in
 * [`field-validation-display.ts`](./field-validation-display.ts).
 *
 * Extracted from `checkout-form.enhancer.ts` verbatim. Each handler takes its own small
 * context; the subscriptions themselves stay in the form, because `this.subscribe` is what
 * records the unsubscribe that `destroy()` runs.
 */

import type { Logger } from '@/core/logger';
import type { CartState } from '@/types/global';
import type { CheckoutValidator } from '../validation/checkout-validator';
import type { CreditCardService } from '../services/credit-card-service';

/** What reacting to a checkout-store change needs from the form. */
export interface CheckoutUpdateContext {
  /** Owns showing a field's message — errors from the store are pushed into it. */
  validator: CheckoutValidator;
  /**
   * The button the shopper presses to pay, once it has been scanned. Read per call rather
   * than captured, because `update()` can rescan the form and replace it.
   */
  submitButton: HTMLButtonElement | undefined;
  /** Reveals the address rows that stay collapsed until a street address exists. */
  showLocationFields: () => void;
}

/** What reacting to a cart-store change needs from the form. */
export interface CartUpdateContext {
  logger: Logger;
}

/** What reacting to a config-store change needs from the form. */
export interface ConfigUpdateContext {
  logger: Logger;
  /** Present once the card fields exist — its absence is what makes this a one-shot. */
  creditCardService: CreditCardService | undefined;
  /** Builds the hosted card fields. The form's own method; this only decides *when*. */
  initializeCreditCard: (
    environmentKey: string,
    debug: boolean
  ) => Promise<void>;
}

/**
 * Applies a checkout-store change to the form: errors onto fields, address rows open,
 * submit button enabled or not.
 *
 * @example
 * ```ts
 * this.subscribe(useCheckoutStore, state =>
 *   handleCheckoutUpdate(
 *     {
 *       validator: this.validator,
 *       submitButton: this.submitButton,
 *       showLocationFields: () => this.showLocationFields(),
 *     },
 *     state
 *   )
 * );
 * ```
 */
export function handleCheckoutUpdate(
  ctx: CheckoutUpdateContext,
  state: any
): void {
  // Handle errors - let the validator handle the display
  if (state.errors && Object.keys(state.errors).length > 0) {
    // The validator will handle error display through its ErrorDisplayManager
    // We just need to make sure the validator knows about the errors
    Object.entries(state.errors).forEach(([fieldName, message]) => {
      ctx.validator.setError(fieldName, message as string);
    });
  }
  // Note: We do NOT call clearAllErrors when state has no errors
  // because that would mark all fields as valid prematurely.
  // Errors should only be cleared field-by-field as they're fixed.

  // Check if address1 was updated and show location fields if needed
  if (state.formData?.address1 && state.formData.address1.trim().length > 0) {
    ctx.showLocationFields();
  }

  // Handle processing state
  if (state.isProcessing) {
    // Disable submit button when processing
    if (ctx.submitButton) {
      ctx.submitButton.disabled = true;
      ctx.submitButton.setAttribute('aria-busy', 'true');
    }
  } else {
    // Enable submit button when not processing
    if (ctx.submitButton) {
      ctx.submitButton.disabled = false;
      ctx.submitButton.setAttribute('aria-busy', 'false');
    }
  }
}

/**
 * Notes a cart the shopper cannot check out with.
 *
 * @example
 * ```ts
 * this.subscribe(useCartStore, state => handleCartUpdate({ logger: this.logger }, state));
 * ```
 */
export function handleCartUpdate(
  ctx: CartUpdateContext,
  cartState: CartState
): void {
  if (cartState.isEmpty) {
    ctx.logger.warn('Cart is empty');
  }
}

/**
 * Builds the hosted card fields if the Spreedly key has only just arrived.
 *
 * @example
 * ```ts
 * this.subscribe(useConfigStore, state =>
 *   handleConfigUpdate(
 *     {
 *       logger: this.logger,
 *       creditCardService: this.creditCardService,
 *       initializeCreditCard: (key, debug) => this.initializeCreditCard(key, debug),
 *     },
 *     state
 *   )
 * );
 * ```
 */
export async function handleConfigUpdate(
  ctx: ConfigUpdateContext,
  configState: any
): Promise<void> {
  try {
    if (configState.spreedlyEnvironmentKey && !ctx.creditCardService) {
      await ctx.initializeCreditCard(configState.spreedlyEnvironmentKey, configState.debug || false);
    }
  } catch (error) {
    ctx.logger.error('Error handling config update:', error);
  }
}
