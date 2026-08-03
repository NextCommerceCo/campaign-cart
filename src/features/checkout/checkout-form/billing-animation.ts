/**
 * Expand / collapse animation for the billing address section.
 *
 * The section animates on `height`, which cannot be transitioned from or to `auto`. So
 * both directions do the same dance: measure the real height, pin it as an explicit pixel
 * value, force a reflow, then transition to the target. The end state differs — expanded
 * settles on `height: auto` so later content can grow it, collapsed stays pinned at `0`.
 *
 * Extracted from `checkout-form.enhancer.ts` as the second cut out of that file. It came
 * out early because it is almost free-standing: it needs three things from the form
 * ({@link BillingAnimationContext}) and calls none of its methods.
 *
 * **Known duplication.** The two functions below are ~90% the same and were deliberately
 * left that way: they were lifted verbatim so this extraction changes no behaviour, and
 * their measurement steps genuinely differ (expand has to set `height: auto` to measure a
 * section that is currently collapsed; collapse can read `scrollHeight` directly).
 * Merging them into one parameterised animation is worth doing — as its own change, where
 * a regression is attributable, rather than mixed into a file move.
 */

import type { Logger } from '@/core/logger';

/** Class the section carries while expanded. Also read by the fallback guard. */
const EXPANDED = 'billing-form-expanded';
/** Class the section carries while collapsed. */
const COLLAPSED = 'billing-form-collapsed';
/** Matches the CSS transition duration, plus a little slack for the fallback. */
const FALLBACK_MS = 350;
const TRANSITION = 'height 0.3s cubic-bezier(0.4, 0, 0.2, 1)';

/**
 * What this module needs from the checkout form.
 *
 * `inProgress` is a **ref, not a boolean**, because both functions here and the form's own
 * toggle handler read and write the same flag — a copied primitive would leave each side
 * with its own. Same shape as `selectedItemRef` in `features/cart/accept-upsell`.
 */
export interface BillingAnimationContext {
  /** True while an animation is running. Guards the fallback from firing on a finished one. */
  inProgress: { value: boolean };
  /**
   * Pending fallback timers, owned by the form so it can clear them on teardown. A leaked
   * timer would fire against a section that is no longer on the page.
   */
  timeouts: Set<NodeJS.Timeout>;
  /**
   * Aborts the in-flight animation's `transitionend` listener.
   *
   * A ref for the same reason as {@link inProgress}: the form holds it so teardown can
   * abort too. Held rather than relying on the listener removing itself, because it does
   * not always get the chance to — see {@link cancelPending}.
   */
  listenerAbort: { value: AbortController | null };
  logger: Logger;
}

/**
 * Forces the browser to apply a pending style change before the next one.
 *
 * Reading `offsetHeight` alone is the usual trick; `getBoundingClientRect()` is read too
 * because the single read was not reliably flushing in production builds, and without a
 * flush the transition never starts — the element jumps instead of animating.
 */
function forceReflow(section: HTMLElement): void {
  void section.offsetHeight;
  void section.getBoundingClientRect();
}

/**
 * Clears any animation still in flight, so a fast double-toggle cannot leave two running.
 *
 * Aborting the previous listener is the part that is easy to miss. Each call to
 * expand/collapse attaches a **new** closure-scoped `transitionend` handler, and that
 * handler only ever removes *itself*, on its own natural firing. Two paths therefore left
 * one attached: the fallback force-completing an animation (the handler never fired), and
 * a shopper re-toggling before the transition finished. The stale handlers then all ran on
 * the next real `transitionend` — each re-settling its own animation and logging a
 * "complete" for a direction the section is no longer going — and accumulated without
 * bound across repeated toggles.
 */
function cancelPending(ctx: BillingAnimationContext): void {
  ctx.timeouts.forEach(timeout => clearTimeout(timeout));
  ctx.timeouts.clear();
  ctx.listenerAbort.value?.abort();
  ctx.listenerAbort.value = null;
  ctx.inProgress.value = true;
}

/**
 * Attaches the settle-on-`transitionend` handler for one animation.
 *
 * Registered with an `AbortSignal` so {@link cancelPending} and the fallback can drop it
 * without holding a reference to the closure itself.
 */
function listenForSettle(
  ctx: BillingAnimationContext,
  section: HTMLElement,
  onSettle: () => void
): void {
  const controller = new AbortController();
  ctx.listenerAbort.value = controller;
  section.addEventListener('transitionend', onSettle, {
    signal: controller.signal,
    once: true,
  });
}

/** Drops the `transitionend` listener for the animation that just finished, however it did. */
function stopListening(ctx: BillingAnimationContext): void {
  ctx.listenerAbort.value?.abort();
  ctx.listenerAbort.value = null;
}

/**
 * Registers the fallback that force-completes an animation whose `transitionend` never
 * arrived — which happens when the tab is backgrounded mid-transition, or when the
 * section is hidden by other CSS.
 *
 * Guarded on both the in-progress flag and the expected class, so it cannot undo a state
 * the shopper has since toggled away from.
 *
 * **`settle` does the logging, not this function.** An earlier version took a `label` and
 * warned with `` `[Billing] ${label} fallback triggered` ``, which looked tidier and was
 * wrong twice over: it merged two separately searchable log strings into one, and a
 * templated message is not a literal at the `logger.warn` call, so the log-reference
 * generator could no longer read it — the line would have disappeared from
 * `reference/logs.md` entirely. Log strings are a contract; keep them literal at the call
 * site.
 */
function registerFallback(
  ctx: BillingAnimationContext,
  section: HTMLElement,
  expectedClass: string,
  settle: () => void
): void {
  const fallbackTimeout = setTimeout(() => {
    if (ctx.inProgress.value && section.classList.contains(expectedClass)) {
      settle();
      stopListening(ctx);
      ctx.inProgress.value = false;
    }
    ctx.timeouts.delete(fallbackTimeout);
  }, FALLBACK_MS);

  ctx.timeouts.add(fallbackTimeout);
}

/**
 * Reveals the billing section, animating from zero to its natural height.
 *
 * Settles on `height: auto` / `overflow: visible` so the section can still grow — a
 * validation message appearing later must not be clipped by a pinned height.
 */
export function expandBillingForm(
  ctx: BillingAnimationContext,
  billingSection: HTMLElement
): void {
  cancelPending(ctx);

  ctx.logger.debug('[Billing] Starting expand animation', {
    startHeight: billingSection.offsetHeight,
    startOverflow: billingSection.style.overflow,
  });

  // Double RAF: one frame is not always enough for the style writes below to be applied
  // before the transition is set, in a production build.
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      // Measure at `auto` — the section is collapsed, so its current height is 0.
      billingSection.style.transition = 'none';
      billingSection.style.height = 'auto';
      const fullHeight = billingSection.scrollHeight;

      ctx.logger.debug('[Billing] Measured full height:', fullHeight);

      billingSection.style.height = '0px';
      billingSection.style.overflow = 'hidden';
      forceReflow(billingSection);

      requestAnimationFrame(() => {
        // `important` because the section's own stylesheet also sets height.
        billingSection.style.setProperty('transition', TRANSITION, 'important');
        billingSection.style.setProperty(
          'height',
          `${fullHeight}px`,
          'important'
        );

        ctx.logger.debug('[Billing] Expand animation started', {
          fromHeight: '0px',
          toHeight: fullHeight,
        });

        const settle = (): void => {
          billingSection.style.transition = 'none';
          billingSection.style.height = 'auto';
          billingSection.style.overflow = 'visible';
        };

        listenForSettle(ctx, billingSection, () => {
          settle();
          stopListening(ctx);
          ctx.inProgress.value = false;

          ctx.logger.info('[Billing] Expand complete', {
            finalHeight: billingSection.style.height,
            finalOverflow: billingSection.style.overflow,
            finalTransition: billingSection.style.transition,
          });
        });

        registerFallback(ctx, billingSection, EXPANDED, () => {
          ctx.logger.warn(
            '[Billing] Expand fallback triggered - forcing completion'
          );
          settle();
        });
      });

      billingSection.classList.add(EXPANDED);
      billingSection.classList.remove(COLLAPSED);
    });
  });
}

/**
 * Hides the billing section, animating from its current height to zero.
 *
 * Stays pinned at `height: 0` / `overflow: hidden` afterwards — unlike expand, there is
 * nothing to grow into.
 */
export function collapseBillingForm(
  ctx: BillingAnimationContext,
  billingSection: HTMLElement
): void {
  cancelPending(ctx);

  ctx.logger.debug('[Billing] Starting collapse animation', {
    startHeight: billingSection.offsetHeight,
    scrollHeight: billingSection.scrollHeight,
  });

  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      // Already visible, so `scrollHeight` is the height to transition away from — no
      // need to set `auto` first the way expand does.
      const currentHeight = billingSection.scrollHeight;

      billingSection.style.transition = 'none';
      billingSection.style.height = `${currentHeight}px`;
      billingSection.style.overflow = 'hidden';
      forceReflow(billingSection);

      requestAnimationFrame(() => {
        billingSection.style.setProperty('transition', TRANSITION, 'important');
        billingSection.style.setProperty('height', '0px', 'important');

        ctx.logger.debug('[Billing] Collapse animation started', {
          fromHeight: currentHeight,
          toHeight: '0px',
        });

        const settle = (): void => {
          billingSection.style.transition = 'none';
          billingSection.style.height = '0px';
          billingSection.style.overflow = 'hidden';
        };

        listenForSettle(ctx, billingSection, () => {
          settle();
          stopListening(ctx);
          ctx.inProgress.value = false;

          ctx.logger.info('[Billing] Collapse complete', {
            finalHeight: billingSection.style.height,
            finalOverflow: billingSection.style.overflow,
            finalTransition: billingSection.style.transition,
          });
        });

        registerFallback(ctx, billingSection, COLLAPSED, () => {
          ctx.logger.warn(
            '[Billing] Collapse fallback triggered - forcing completion'
          );
          settle();
        });
      });

      billingSection.classList.add(COLLAPSED);
      billingSection.classList.remove(EXPANDED);
    });
  });
}
