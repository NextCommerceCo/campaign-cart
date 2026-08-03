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
 * **The submit button is only ever put back the way this code found it.** Disabling a pay
 * button until a condition is met — terms accepted, an age confirmed — is the ordinary way
 * a page author gates a checkout, and it is markup this module did not write. So the
 * button's `disabled` is remembered at the moment processing starts and restored when
 * processing ends; a button nothing here disabled is never touched. See
 * {@link handleCheckoutUpdate}.
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
import type { SubmitControl } from './field-scanning';

/**
 * What the submit button's `disabled` was before an order started being placed.
 *
 * Keyed by the element, so a re-scan that hands back the same button keeps the same
 * memory, and a button removed from the page is collected with it. An element **absent**
 * from this map is one this module has not disabled — and so one it must not enable.
 */
const disabledBeforeProcessing = new WeakMap<SubmitControl, boolean>();

/** What reacting to a checkout-store change needs from the form. */
export interface CheckoutUpdateContext {
  /** Owns showing a field's message — errors from the store are pushed into it. */
  validator: CheckoutValidator;
  /**
   * The control the shopper presses to pay, once it has been scanned. Read per call rather
   * than captured, because `update()` can rescan the form and replace it.
   */
  submitButton: SubmitControl | undefined;
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
 * submit button held shut while the order is placed.
 *
 * This runs on **every** checkout-store change — the shopper's first keystroke included —
 * so it treats `disabled` as borrowed, not owned: the value is remembered when processing
 * starts and put back when processing ends. A pay button the page disabled itself is
 * therefore still disabled afterwards, and a failed order still leaves a re-clickable
 * button, because that button was enabled when the attempt began.
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
  const submitControl = ctx.submitButton;
  if (!submitControl) return;

  if (state.isProcessing) {
    // Remember the page's own answer once — a second `isProcessing: true` update must not
    // record the `true` this branch just wrote.
    if (!disabledBeforeProcessing.has(submitControl)) {
      disabledBeforeProcessing.set(submitControl, submitControl.disabled);
    }
    submitControl.disabled = true;
    submitControl.setAttribute('aria-busy', 'true');
  } else if (disabledBeforeProcessing.has(submitControl)) {
    // Only an order this module disabled the button for is undone here. Anything else —
    // the shopper typing, a shipping method arriving — leaves the button as the page left it.
    submitControl.disabled =
      disabledBeforeProcessing.get(submitControl) ?? false;
    disabledBeforeProcessing.delete(submitControl);
    submitControl.setAttribute('aria-busy', 'false');
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
      await ctx.initializeCreditCard(
        configState.spreedlyEnvironmentKey,
        configState.debug || false
      );
    }
  } catch (error) {
    ctx.logger.error('Error handling config update:', error);
  }
}
