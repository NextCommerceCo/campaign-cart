/**
 * Bringing the prospect cart to life on a checkout form, and hearing back from it.
 *
 * A **prospect cart** is a cart recorded on the server from a partly-filled checkout —
 * contact details and the cart lines, no address — so a shopper who leaves can be sent a
 * recovery email. `ProspectCartEnhancer` owns the cart itself; this module owns only its
 * *lifecycle inside the form*: construct it against the form element, start it, and log
 * the two events it dispatches back.
 *
 * It is deliberately failure-tolerant. A prospect cart is a marketing convenience, never a
 * condition of buying, so a start-up failure is logged at `warn` and swallowed rather than
 * thrown — the shopper still gets a working checkout. The half-started instance is still
 * handed back, because `CheckoutFormEnhancer.destroy()` is what tears down the listeners
 * it may already have registered; returning `undefined` on failure would leak them.
 *
 * It is not registered with `AttributeScanner`. The prospect cart's manifest documents the
 * same `form[data-next-checkout]` as the form itself, but the scanner never instantiates
 * it — this module does, which is why it exists only where an enhanced checkout form does.
 *
 * Extracted from `checkout-form.enhancer.ts` verbatim. It needs three things from the form
 * ({@link ProspectCartLifecycleContext}).
 *
 * @see [`contact-persistence.ts`](./contact-persistence.ts) — what drives it afterwards:
 * every committed contact field is pushed into the cart from there.
 */

import type { Logger } from '@/core/logger';
import { ProspectCartEnhancer } from '../prospect-cart/prospect-cart.enhancer';

/** The three things this module needs from the checkout form. */
export interface ProspectCartLifecycleContext {
  /** The form the prospect cart binds to — it reads its own fields off this element. */
  form: HTMLFormElement;
  logger: Logger;
  /**
   * `CheckoutFormEnhancer.listen` — an `addEventListener` bound to the form's lifetime.
   * The two handlers below are inline arrows, which `removeEventListener` can never match,
   * so they have to go through the form's abort signal to be removable at all.
   */
  listen: (
    target: HTMLElement,
    type: string,
    handler: (event: Event) => void
  ) => void;
}

/**
 * Starts the prospect cart for this form and returns it, or `undefined` if it could not
 * be constructed at all.
 *
 * Assign the result to the field the rest of the form reads; a returned instance whose
 * `initialize()` threw is still a live enhancer that `destroy()` must reach.
 *
 * @example
 * ```ts
 * this.prospectCartEnhancer = await initializeProspectCart({
 *   form: this.form,
 *   logger: this.logger,
 *   listen: (target, type, handler) => this.listen(target, type, handler),
 * });
 * ```
 */
export async function initializeProspectCart(
  ctx: ProspectCartLifecycleContext
): Promise<ProspectCartEnhancer | undefined> {
  let prospectCartEnhancer: ProspectCartEnhancer | undefined;

  try {
    // Initialize ProspectCartEnhancer with email entry trigger
    prospectCartEnhancer = new ProspectCartEnhancer(ctx.form);

    // Configure it to trigger on email entry
    await prospectCartEnhancer.initialize();

    // Listen for prospect cart events
    ctx.listen(ctx.form, 'next:prospect-cart-created', (event: Event) => {
      const customEvent = event as CustomEvent;
      ctx.logger.info('Prospect cart created', customEvent.detail);
    });

    ctx.listen(ctx.form, 'next:prospect-cart-abandoned', (event: Event) => {
      const customEvent = event as CustomEvent;
      ctx.logger.info('Prospect cart abandoned', customEvent.detail);
    });

    ctx.logger.debug('ProspectCartEnhancer initialized');
  } catch (error) {
    ctx.logger.warn('Failed to initialize ProspectCartEnhancer:', error);
    // Don't throw - prospect cart is not critical for checkout
  }

  return prospectCartEnhancer;
}
