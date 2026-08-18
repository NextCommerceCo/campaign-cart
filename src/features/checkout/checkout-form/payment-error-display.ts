/**
 * The banner a shopper sees when a payment is declined — and the guard that stops it
 * announcing itself into an infinite loop.
 *
 * Two halves that share one flag:
 *
 * - **{@link displayPaymentError}** writes the message into the page's credit-error
 *   container, forces it visible, hides it again after ten seconds, and then re-emits
 *   `payment:error` so anything else on the page (analytics, a custom handler) hears it.
 * - **{@link listenForPaymentErrors}** is the other end: payment failures raised *elsewhere*
 *   — express checkout, Spreedly — arrive on the bus and surface in this form.
 *
 * **The display emits the event the listener handles.** Without a guard, the first decline
 * is displayed, its own echo comes straight back to the listener, is displayed again, emits
 * again — unbounded synchronous recursion on the live express-decline path (finding 150 in
 * `docs/code-findings.md`). `announcingPaymentError` is a ref rather than a local so both
 * halves read the *same* flag; it is true only for the duration of that one synchronous
 * emit, which is exactly what tells our own echo apart from a real error raised elsewhere.
 * If you move either half, the ref moves with it.
 *
 * **Which** container it writes into is not this module's decision — see
 * [`payment-error-container.ts`](../utils/payment-error-container.ts), which is
 * shared with the express processor and the card tokenizer so all three name the
 * same element. It is what makes `<method>-error` work for every way of paying
 * rather than for the two the SDK used to hard-code, and what stops a decline
 * being written into a container the chosen method has collapsed shut.
 *
 * Extracted from `checkout-form.enhancer.ts` verbatim. Each half needs three things from
 * the form ({@link PaymentErrorDisplayContext}, {@link PaymentErrorListenerContext}).
 */

import type { Logger } from '@/core/logger';
import type { EventMap } from '@/types/global';

import {
  resolvePaymentErrorTarget,
  showPaymentErrorTarget,
} from '../utils/payment-error-container';

/** What showing a payment error needs from the checkout form. */
export interface PaymentErrorDisplayContext {
  logger: Logger;
  /** The method the failure belongs to, so its own `<method>-error` can be found. */
  paymentMethod: () => string;
  /**
   * True only while this module is emitting its own `payment:error` echo. Shared by
   * reference with {@link PaymentErrorListenerContext} — one flag, two readers.
   */
  announcingPaymentError: { value: boolean };
  /** `CheckoutFormEnhancer.emit` for `payment:error`. */
  emit: (detail: EventMap['payment:error']) => void;
}

/** What listening for payment errors needs from the checkout form. */
export interface PaymentErrorListenerContext {
  /** The same ref {@link PaymentErrorDisplayContext} holds — see its note. */
  announcingPaymentError: { value: boolean };
  /**
   * `CheckoutFormEnhancer.on` for `payment:error` — registered through the form's own
   * helper, not `eventBus.on`, so the subscription dies with the form. The bus is a
   * page-lifetime singleton, so a handler it records no unsubscribe for keeps firing on a
   * destroyed enhancer.
   */
  on: (handler: (data: EventMap['payment:error']) => void) => void;
  /** Shows the message — the form's own method, so the two halves stay swappable. */
  displayPaymentError: (message: string) => void;
}

/**
 * Surfaces payment errors raised by other components in this form.
 *
 * @example
 * ```ts
 * listenForPaymentErrors({
 *   announcingPaymentError: this.announcingPaymentError,
 *   on: handler => this.on('payment:error', handler),
 *   displayPaymentError: message => this.displayPaymentError(message),
 * });
 * ```
 */
export function listenForPaymentErrors(ctx: PaymentErrorListenerContext): void {
  ctx.on(event => {
    if (ctx.announcingPaymentError.value) return;
    if (event.message) {
      ctx.displayPaymentError(event.message);
    }
  });
}

/**
 * Puts a payment failure in front of the shopper, then tells the rest of the page.
 *
 * @example
 * ```ts
 * displayPaymentError(
 *   { logger, announcingPaymentError, emit: detail => this.emit('payment:error', detail) },
 *   'Your card was declined.'
 * );
 * ```
 */
export function displayPaymentError(
  ctx: PaymentErrorDisplayContext,
  message: string
): void {
  ctx.logger.info('[Payment Error] Displaying error:', message);

  // Use a slight delay to ensure DOM is ready
  setTimeout(() => {
    const target = resolvePaymentErrorTarget(ctx.paymentMethod(), ctx.logger);
    if (!target) {
      ctx.logger.error(
        '[Payment Error] Could not find error container element'
      );
      return;
    }

    target.text.textContent = message;
    showPaymentErrorTarget(target);

    ctx.logger.info(
      '[Payment Error] Error container shown with message:',
      message
    );

    // Auto-hide after 10 seconds, unless a newer failure has replaced the text
    // in the meantime — the container is shared, and hiding someone else's
    // message is how a second decline went unread.
    setTimeout(() => {
      if (target.text.textContent !== message) return;
      target.container.style.display = 'none';
      target.container.classList.remove('visible');
    }, 10000);
  }, 100); // Small delay to ensure DOM is ready

  // Also emit an event for other components to handle. The flag marks this as
  // our own echo, so `listenForPaymentErrors` does not display it a second time.
  ctx.announcingPaymentError.value = true;
  try {
    ctx.emit({ message });
  } finally {
    ctx.announcingPaymentError.value = false;
  }
}
