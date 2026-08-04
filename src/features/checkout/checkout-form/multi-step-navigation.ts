/**
 * Multi-step checkout: recognising that this form is one step of several, and moving the
 * shopper to the next one.
 *
 * A multi-step checkout is one page per step, not one page with panels. Each page carries
 * its own `<form data-next-checkout>`; the form declares **where the next step lives**
 * (`data-next-checkout-step`, a URL) and **which step it is** (`data-next-step-number`).
 * Pressing submit on such a form therefore never creates an order — it validates the
 * fields that belong to this step and, if they pass, navigates to the next page. The
 * values themselves are already in the checkout store, written there as the shopper typed,
 * so nothing has to be carried across the navigation.
 *
 * Two functions, run at opposite ends of the form's life:
 *
 * - {@link detectMultiStepCheckout} runs once at boot and reads the two attributes;
 * - {@link handleStepNavigation} runs on every submit, in place of order creation.
 *
 * Extracted from `checkout-form.enhancer.ts`. Detection needs three things from the form
 * ({@link MultiStepDetectionContext}); navigation needs eight
 * ({@link StepNavigationContext}). Both were lifted verbatim, and both have since had the
 * unreadable-step-number half of finding 181 fixed in them.
 */

import type { CountryConfig } from '@/core/country-service';
import type { Logger } from '@/core/logger';
import { preserveQueryParams } from '@/core/url-utils';
import type { LoadingOverlay } from '@/core/ui/loading-overlay';
import type { CheckoutState } from '@/state/checkout';

import type { CheckoutValidator } from '../validation/checkout-validator';

/** How long the loading overlay is held before the browser leaves the page. */
const NAVIGATION_DELAY_MS = 1000;
/** Gives the error labels a frame to render before the first one is focused. */
const FOCUS_DELAY_MS = 100;

/**
 * The steps `validateStep` has rules for. Every other number validates nothing there and
 * comes back valid, which is why one is substituted before the check rather than after.
 */
const STEPS_WITH_RULES = new Set([1, 2, 3]);
/**
 * The gate an unrecognised step is checked against: contact details and the shipping
 * address. Step 3's rules would demand card fields the page may not have; step 2's are the
 * fields every checkout needs whichever page they were typed on.
 */
const FALLBACK_VALIDATION_STEP = 2;

/**
 * Reads `data-next-step-number`, which is a whole number above zero or a mistake.
 *
 * A missing attribute is the ordinary first step. Anything else unreadable — `two`, `0`,
 * `2.5` — is warned about and treated as step 1, because the first step's rules are the
 * strictest gate available and a step nobody can name must not be the loosest.
 */
function readStepNumber(rawStep: string | null, logger: Logger): number {
  if (rawStep === null) return 1;

  if (!/^\d+$/.test(rawStep.trim()) || parseInt(rawStep, 10) < 1) {
    logger.warn(
      `Step number "${rawStep}" is not a whole number above zero, treating this form as step 1`
    );
    return 1;
  }

  return parseInt(rawStep, 10);
}

/** What {@link detectMultiStepCheckout} needs from the checkout form. */
export interface MultiStepDetectionContext {
  form: HTMLFormElement;
  logger: Logger;
  /** `checkoutStore.setStep` — the store carries the step across the navigation. */
  setStep: (step: number) => void;
}

/** Which step this form is, and where "next" goes. */
export interface MultiStepState {
  /** True only when the form declared a next-step URL. */
  isMultiStep: boolean;
  /**
   * The step this page is, from `data-next-step-number`. Defaults to 1, and falls back to
   * 1 with a warning when the attribute is not a whole number above zero.
   */
  currentStep: number;
  /** The URL the next step lives at — the value of the activating attribute. */
  nextStepUrl: string;
}

/** What {@link handleStepNavigation} needs from the checkout form. */
export interface StepNavigationContext {
  /** The step being left, as {@link detectMultiStepCheckout} read it. */
  currentStep: number;
  /** Where the shopper goes once this step validates. */
  nextStepUrl: string | undefined;
  /**
   * Runs the step's rules and owns showing and focusing the messages.
   *
   * Narrowed to the three members this module calls rather than the whole
   * `CheckoutValidator`: the class carries twenty fields a step-navigation test has no
   * reason to build, and demanding them turns every test double into an `as any` — the
   * dishonest-fixture shape `npm run type-check:tests` exists to catch (finding 116).
   */
  validator: Pick<
    CheckoutValidator,
    'validateStep' | 'showError' | 'focusFirstErrorField'
  >;
  /** Per-country address rules, for the postcode and province checks. */
  countryConfigs: Map<string, CountryConfig>;
  /** Ref, shared with `state-fields.ts` — the config of the country now selected. */
  currentCountryConfig: { value: CountryConfig | undefined };
  /** Covers the page while the step is checked and while the browser navigates. */
  loadingOverlay: LoadingOverlay;
  /**
   * The billing address and the shopper's same-as-shipping choice, from the one place the
   * form reads them — see `CheckoutFormEnhancer.getBillingValidationInput`.
   */
  getBillingValidationInput: () => {
    billingAddress: CheckoutState['billingAddress'];
    sameAsShipping: boolean;
  };
  logger: Logger;
}

/**
 * Reads the multi-step attributes off the form, and tells the store which step this is.
 *
 * Returns `null` for an ordinary single-page checkout — the common case — so the caller
 * leaves its defaults alone. Both attribute spellings are accepted;
 * `data-next-checkout-step` is the current one and `os-checkout-step` the legacy. A step
 * number that is not a whole number above zero is warned about and read as step 1.
 *
 * @example
 * ```ts
 * const state = detectMultiStepCheckout({
 *   form,
 *   logger,
 *   setStep: step => useCheckoutStore.getState().setStep(step),
 * });
 * // <form data-next-checkout-step="/checkout/payment" data-next-step-number="2">
 * // → { isMultiStep: true, currentStep: 2, nextStepUrl: '/checkout/payment' }
 * ```
 */
export function detectMultiStepCheckout(
  ctx: MultiStepDetectionContext
): MultiStepState | null {
  // Check for data-next-checkout-step attribute on form
  const stepAttr =
    ctx.form.getAttribute('data-next-checkout-step') ||
    ctx.form.getAttribute('os-checkout-step');

  if (!stepAttr) return null;

  const state: MultiStepState = {
    isMultiStep: true,
    currentStep: readStepNumber(
      ctx.form.getAttribute('data-next-step-number'),
      ctx.logger
    ),
    nextStepUrl: stepAttr,
  };

  ctx.logger.info('Multi-step checkout detected', {
    currentStep: state.currentStep,
    nextStepUrl: state.nextStepUrl,
  });

  // Update store step
  ctx.setStep(state.currentStep);

  return state;
}

/**
 * Validates the current step and, if it passes, sends the shopper to the next page.
 *
 * Only steps 1, 2 and 3 have rules; a form declaring any other number is checked against
 * step 2's — contact details and the shipping address — so an unrecognised step is still a
 * gate rather than a wave-through. The store is still advanced to the step the shopper
 * actually reached.
 *
 * Replaces order creation on a multi-step form: nothing is submitted to the API here. On
 * failure every message is written to the store *and* to the page, the first problem is
 * focused, and the shopper stays put. On success the store's step is advanced before
 * navigating, so the next page knows where it is, and the session parameters (currency,
 * country, utm…) are carried onto the next URL.
 *
 * Never throws: any failure leaves the shopper on the page with a general error rather
 * than behind a permanent loading overlay.
 *
 * @example
 * ```ts
 * // in the submit handler, before any order work
 * if (this.isMultiStep && this.nextStepUrl) {
 *   return handleStepNavigation(this.stepNavigationContext(), checkoutStore);
 * }
 * ```
 */
export async function handleStepNavigation(
  ctx: StepNavigationContext,
  checkoutStore: any
): Promise<void> {
  try {
    checkoutStore.clearAllErrors();
    checkoutStore.setProcessing(true);

    // Show loading overlay
    ctx.loadingOverlay.show();

    ctx.logger.info(`Validating step ${ctx.currentStep} before navigation`);

    // A step outside 1–3 has no rules of its own, and asking for them returns "valid" —
    // a gate that checks nothing. Check it against the address step instead.
    let validationStep = ctx.currentStep;
    if (!STEPS_WITH_RULES.has(validationStep)) {
      ctx.logger.warn(
        `Step ${ctx.currentStep} has no rules of its own, validating it as the address step`
      );
      validationStep = FALLBACK_VALIDATION_STEP;
    }

    // Validate only current step fields. Step 3 is the last gate before payment, so it
    // needs the billing pair too — see getBillingValidationInput().
    const billing = ctx.getBillingValidationInput();
    const validation = await ctx.validator.validateStep(
      validationStep,
      checkoutStore.formData,
      ctx.countryConfigs,
      ctx.currentCountryConfig.value,
      billing.billingAddress,
      billing.sameAsShipping
    );

    if (!validation.isValid) {
      ctx.logger.warn(
        `Step ${ctx.currentStep} validation failed`,
        validation.errors
      );

      // Display errors
      if (validation.errors) {
        Object.entries(validation.errors).forEach(([field, error]) => {
          checkoutStore.setError(field, error as string);
          ctx.validator.showError(field, error as string);
        });
      }

      // Focus first error field
      if (validation.firstErrorField) {
        setTimeout(() => {
          ctx.validator.focusFirstErrorField(validation.firstErrorField);
        }, FOCUS_DELAY_MS);
      }

      // Clear processing state and hide overlay on validation error
      checkoutStore.setProcessing(false);
      ctx.loadingOverlay.hide(true);
      return;
    }

    // Validation passed - data is already saved in checkoutStore via field change handlers
    // Navigate to next step
    ctx.logger.info(
      `Step ${ctx.currentStep} validated successfully, navigating to: ${ctx.nextStepUrl}`
    );

    // Update step in store before navigation
    checkoutStore.setStep(ctx.currentStep + 1);

    // Build next URL with all session parameters preserved (currency, country, utm params, etc.)
    const nextUrl = preserveQueryParams(ctx.nextStepUrl!);
    ctx.logger.debug('Preserving all session parameters in next step URL');

    // Add a small delay to show the loading spinner before navigation
    await new Promise(resolve => setTimeout(resolve, NAVIGATION_DELAY_MS));

    // Clear processing state before navigation to prevent it persisting to next page
    checkoutStore.setProcessing(false);

    // Navigate to next page (loading overlay will be cleared by page navigation)
    window.location.href = nextUrl;
  } catch (error) {
    ctx.logger.error('Step navigation error:', error);
    checkoutStore.setError(
      'general',
      'Failed to proceed to next step. Please try again.'
    );
    checkoutStore.setProcessing(false);
    ctx.loadingOverlay.hide(true);
  }
}
