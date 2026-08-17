/**
 * Finding the element a payment failure should be written into.
 *
 * A checkout can offer fourteen ways to pay and any of them can be refused, so
 * "where does the message go" is one question with one answer, asked by three
 * unrelated writers: the checkout form's own decline handler, the Spreedly
 * tokenizer's field errors, and the express processor. Each used to answer it
 * with its own `document.querySelector`, and between them they only ever named
 * two containers — `credit-error` and `paypal-error`.
 *
 * That is what issue #75's thread turned up: a shopper who picked iDEAL and was
 * refused saw nothing. The message really was written, into `credit-error`, which
 * the starter templates put **inside the card's own `data-next-payment-form`** —
 * and that form is collapsed to `height: 0; overflow: hidden` whenever a card is
 * not the chosen method. Measured in Chromium: text present, `display: flex`,
 * 18px tall, clipped out of existence by a parent of height 0.
 *
 * So the rule here is:
 *
 * 1. **The chosen method's own container**, `<method>-error`, if the page has
 *    one. This is the convention the starter templates already use for `credit`,
 *    `paypal`, `klarna`, `apple-pay` and `google-pay`; it now works for every
 *    method rather than for the two the SDK happened to hard-code.
 * 2. **`credit-error`**, which is what every page shipped before this and is
 *    still the only container most of them have.
 * 3. If what that found is sealed inside a collapsed payment form, the message
 *    is moved **out of the form and into the method's wrapper**, which is always
 *    visible. Nothing is asked of the page: this is what makes a checkout already
 *    live on 0.4.35 start showing declines again without its markup being touched.
 *
 * The `-text` child is optional. A page that wrote only `<div
 * data-next-component="ideal-error">` and no inner text element gets the message
 * written straight into the container, because a container with no message in it
 * is the same silence this module exists to end.
 */

import type { Logger } from '@/core/logger';

import { namesStoredPaymentMethod } from '../constants/field-mappings';

/** Where a payment failure is going to be written. */
export interface PaymentErrorTarget {
  /** The element to reveal. */
  container: HTMLElement;
  /** The element the message text goes into — the container itself if it has no `-text` child. */
  text: HTMLElement;
}

/**
 * The wrapper for the method the shopper currently has chosen.
 *
 * Matched through {@link namesStoredPaymentMethod} rather than by string equality,
 * because the wrapper carries the page's word (`credit`, `apple-pay`) and the store
 * carries its own (`credit-card`, `apple_pay`).
 */
function selectedWrapper(method: string): HTMLElement | null {
  const wrappers = document.querySelectorAll<HTMLElement>(
    '[data-next-payment-method]'
  );

  for (const wrapper of wrappers) {
    const markup = wrapper.getAttribute('data-next-payment-method');
    if (namesStoredPaymentMethod(markup, method)) return wrapper;
  }

  return null;
}

/**
 * Every spelling of `<method>-error` worth looking for, most specific first.
 *
 * Both separators are tried because the two vocabularies disagree about them and
 * a page may carry either: the store says `apple_pay`, the starter templates
 * write `apple-pay-error`, and a page that wrote `apple_pay-error` is not wrong
 * enough to be ignored.
 */
function errorComponentNames(markup: string | null, method: string): string[] {
  const words = [markup, method].filter((w): w is string => Boolean(w));
  const names = new Set<string>();

  for (const word of words) {
    const lower = word.trim().toLowerCase();
    if (!lower) continue;
    names.add(`${lower}-error`);
    names.add(`${lower.replace(/_/g, '-')}-error`);
    names.add(`${lower.replace(/-/g, '_')}-error`);
  }

  return [...names];
}

function componentIn(root: ParentNode, name: string): HTMLElement | null {
  return root.querySelector<HTMLElement>(`[data-next-component="${name}"]`);
}

/**
 * Whether this element is sealed inside a payment form that is currently shut.
 *
 * Reads `data-next-payment-state`, which the SDK writes itself in
 * `payment-form-display.ts`, rather than measuring geometry: the attribute is the
 * SDK's own record of the decision, and it is right before the animation that
 * implements it has finished.
 */
function isSealedInCollapsedForm(element: HTMLElement): boolean {
  const form = element.closest<HTMLElement>('[data-next-payment-form]');
  return form?.getAttribute('data-next-payment-state') === 'collapsed';
}

/** The `-text` child if the page wrote one, otherwise the container itself. */
function textElementOf(container: HTMLElement, name: string): HTMLElement {
  return componentIn(container, `${name}-text`) ?? container;
}

/**
 * Moves a container out of the collapsed form that is hiding it, into the method
 * wrapper around that form.
 *
 * The element itself is moved rather than copied, so it keeps the classes and
 * styles the page gave it and there is never a second copy to get out of step.
 * It stays where it is put: moving it back on the next method change would only
 * seal it away again.
 */
function liftOutOfCollapsedForm(
  container: HTMLElement,
  logger: Logger
): boolean {
  const form = container.closest<HTMLElement>('[data-next-payment-form]');
  const wrapper = form?.closest<HTMLElement>('[data-next-payment-method]');
  if (!form || !wrapper) return false;

  wrapper.appendChild(container);
  logger.info(
    'Moved the payment error container out of a collapsed payment form so the shopper can read it',
    {
      component: container.getAttribute('data-next-component'),
      outOf: form
        .closest('[data-next-payment-method]')
        ?.getAttribute('data-next-payment-method'),
    }
  );
  return true;
}

/**
 * Finds where a payment failure for `method` should be written, and makes sure it
 * is somewhere the shopper can actually read.
 *
 * `null` means the page has no payment error container at all — the caller should
 * say so in a log rather than dropping the failure in silence.
 *
 * @example
 * ```ts
 * const target = resolvePaymentErrorTarget('ideal', logger);
 * if (target) {
 *   target.text.textContent = 'Your iDEAL payment was declined.';
 *   showPaymentErrorTarget(target);
 * }
 * ```
 */
export function resolvePaymentErrorTarget(
  method: string | undefined,
  logger: Logger
): PaymentErrorTarget | null {
  const chosen = method ?? '';
  const wrapper = chosen ? selectedWrapper(chosen) : null;
  const markup = wrapper?.getAttribute('data-next-payment-method') ?? null;

  // The chosen method's own container, looked for inside its wrapper first so a
  // page with several `*-error` slots cannot hand back a different method's.
  for (const name of errorComponentNames(markup, chosen)) {
    const container =
      (wrapper && componentIn(wrapper, name)) ?? componentIn(document, name);
    if (container) {
      return { container, text: textElementOf(container, name) };
    }
  }

  // What every page shipped before this convention existed.
  const fallback = componentIn(document, 'credit-error');
  if (!fallback) return null;

  if (isSealedInCollapsedForm(fallback)) {
    liftOutOfCollapsedForm(fallback, logger);
  }

  return { container: fallback, text: textElementOf(fallback, 'credit-error') };
}

/**
 * Reveals a container the page may be hiding in any of four ways.
 *
 * `display`, `visibility`, `opacity` and a `hidden` class are each enough on their
 * own to swallow a decline, and a shopper who sees no message reads the silence as
 * "nothing happened" and presses pay again.
 */
export function showPaymentErrorTarget(target: PaymentErrorTarget): void {
  const { container } = target;
  container.style.display = 'flex';
  container.style.visibility = 'visible';
  container.style.opacity = '1';
  container.classList.add('visible');
  container.classList.remove('hidden');
}

/** Hides every payment error container on the page, whichever method owns it. */
export function hideAllPaymentErrors(): void {
  const containers = document.querySelectorAll<HTMLElement>(
    '[data-next-component$="-error"]'
  );

  for (const container of containers) {
    container.style.display = 'none';
    container.classList.remove('visible');
  }
}
