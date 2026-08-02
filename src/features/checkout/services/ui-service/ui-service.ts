/**
 * Everything the checkout form *looks* like, as opposed to what it knows.
 *
 * `UIService` is what the checkout form hands its visual work to: which sections are
 * busy, which validation messages are showing, which payment form is open, and where each
 * field's label is sitting. It holds no checkout data and makes no decisions about
 * validity — it is told, and it shows.
 *
 * It is an orchestrator: it owns the four pieces of mutable state below and delegates
 * every behaviour to a sibling module, each of which takes an explicit context object
 * rather than reaching back in here.
 *
 * | Module | Owns | Needs from here |
 * |---|---|---|
 * | [`loading-state.ts`](./loading-state.ts) | Busy states and the progress bar | 3 |
 * | [`field-error-display.ts`](./field-error-display.ts) | Validation messages, scroll-to-error, ARIA | 5 |
 * | [`payment-form-display.ts`](./payment-form-display.ts) | Revealing the chosen payment method's fields | 3 |
 * | [`floating-labels.ts`](./floating-labels.ts) | Labels that float above filled inputs | 5 |
 *
 * **Caution — nothing calls `destroy()` today.** `CheckoutFormEnhancer.destroy()` tears
 * down its validator, card service, prospect cart, phone inputs, and autocomplete, but
 * not this service. The symptom is a checkout page that keeps a 500 ms interval and every
 * floating-label listener alive after the form is gone — invisible on a normal checkout,
 * which navigates away, and a slow leak on a single-page flow that re-enhances a form.
 * The fix is one line in that enhancer's `destroy()`: `this.ui?.destroy();`.
 */

import type { Logger } from '@/core/logger';
import type { CartState } from '@/types/global';

import { ErrorDisplayManager } from '../../utils/error-display-utils';
import { EventHandlerManager } from '../../utils/event-handler-utils';

import type { FieldErrorDisplayContext } from './field-error-display';
import {
  displayErrors as displayFieldErrors,
  enhanceAccessibility as enhanceFieldAccessibility,
  focusFirstError as focusFirstErrorField,
  updateFieldState as updateFieldDisplayState,
} from './field-error-display';
import type { FloatingLabelContext } from './floating-labels';
import {
  handleResponsiveUI as applyResponsiveUI,
  handleSpreedlyFieldBlur as blurSpreedlyLabel,
  handleSpreedlyFieldFocus as focusSpreedlyLabel,
  handleSpreedlyFieldInput as inputSpreedlyLabel,
  initializeFloatingLabels,
  setupFloatingLabel as setupFieldFloatingLabel,
  updateLabelsForPopulatedData as refreshFloatingLabels,
} from './floating-labels';
import type { LoadingStateContext } from './loading-state';
import {
  hideLoading as hideSectionLoading,
  showLoading as showSectionLoading,
  updateProgress as updateProgressBar,
} from './loading-state';
import type { PaymentFormDisplayContext } from './payment-form-display';
import {
  initializePaymentForms as initializePaymentFormDisplay,
  updatePaymentFormVisibility as applyPaymentFormVisibility,
} from './payment-form-display';

export class UIService {
  private form: HTMLFormElement;
  private fields: Map<string, HTMLElement>;
  private billingFields?: Map<string, HTMLElement>;
  private logger: Logger;

  // Utility managers
  private errorManager: ErrorDisplayManager;
  private eventManager: EventHandlerManager;

  // Floating label management
  private floatingLabels: Map<HTMLElement, HTMLLabelElement> = new Map();
  /** Autofill poll's interval id. A ref so `floating-labels.ts` can set it. */
  private periodicCheck: { value: number | undefined } = { value: undefined };

  // Loading state management
  private loadingStates: Map<string, boolean> = new Map();

  // Error state tracking
  private lastErrorsString: string = '';

  constructor(
    form: HTMLFormElement,
    fields: Map<string, HTMLElement>,
    logger: Logger,
    billingFields?: Map<string, HTMLElement>
  ) {
    this.form = form;
    this.fields = fields;
    this.logger = logger;
    if (billingFields) {
      this.billingFields = billingFields;
    }

    // Initialize utility managers
    this.errorManager = new ErrorDisplayManager();
    this.eventManager = new EventHandlerManager();
  }

  /**
   * Initialize the UI service with all functionality
   */
  public initialize(): void {
    initializeFloatingLabels(this.floatingLabelContext());
    this.logger.debug('UIService initialized');
  }

  // ============================================================================
  // CONTEXTS HANDED TO THE MODULES
  // ============================================================================

  /**
   * Rebuilt per call rather than held, so a module can never see a stale `billingFields`
   * — the form assigns that map after construction on a checkout with separate billing.
   */
  private loadingContext(): LoadingStateContext {
    return {
      form: this.form,
      loadingStates: this.loadingStates,
      logger: this.logger,
    };
  }

  private fieldErrorContext(): FieldErrorDisplayContext {
    return {
      form: this.form,
      fields: this.fields,
      billingFields: this.billingFields,
      errors: this.errorManager,
      logger: this.logger,
    };
  }

  private paymentFormContext(): PaymentFormDisplayContext {
    return {
      form: this.form,
      errors: this.errorManager,
      logger: this.logger,
    };
  }

  private floatingLabelContext(): FloatingLabelContext {
    return {
      form: this.form,
      labels: this.floatingLabels,
      events: this.eventManager,
      periodicCheck: this.periodicCheck,
      logger: this.logger,
    };
  }

  // ============================================================================
  // LOADING STATE MANAGEMENT — see loading-state.ts
  // ============================================================================

  /**
   * Show loading state for a specific section
   */
  public showLoading(section: string): void {
    showSectionLoading(this.loadingContext(), section);
  }

  /**
   * Hide loading state for a specific section
   */
  public hideLoading(section: string): void {
    hideSectionLoading(this.loadingContext(), section);
  }

  /**
   * Update progress indicator
   */
  public updateProgress(step: number): void {
    updateProgressBar(this.loadingContext(), step);
  }

  // ============================================================================
  // ERROR MANAGEMENT — see field-error-display.ts
  // ============================================================================

  /**
   * Display form validation errors
   */
  public displayErrors(
    errors: Record<string, string>,
    scrollToField?: string
  ): void {
    displayFieldErrors(this.fieldErrorContext(), errors, scrollToField);
  }

  /**
   * Focus and scroll to the first error field
   */
  public focusFirstError(fieldName: string): void {
    focusFirstErrorField(this.fieldErrorContext(), fieldName);
  }

  /**
   * Update field state with visual indicators
   */
  public updateFieldState(
    fieldName: string,
    state: 'valid' | 'invalid' | 'neutral'
  ): void {
    updateFieldDisplayState(this.fieldErrorContext(), fieldName, state);
  }

  // ============================================================================
  // CHECKOUT STATE MANAGEMENT
  // ============================================================================

  /**
   * Handle checkout state updates
   */
  public handleCheckoutUpdate(
    state: any,
    displayErrors: (errors: Record<string, string>) => void
  ): void {
    // Only update errors if they actually changed
    const currentErrorsString = JSON.stringify(state.errors || {});
    if (currentErrorsString !== this.lastErrorsString) {
      this.lastErrorsString = currentErrorsString;

      // Update UI based on checkout state
      if (state.errors && Object.keys(state.errors).length > 0) {
        displayErrors(state.errors);
      } else {
        // Clear all errors when there are no errors in state
        displayErrors({});
      }
    }

    if (state.isProcessing) {
      this.showLoading('checkout');
    } else {
      this.hideLoading('checkout');
    }
  }

  /**
   * Handle cart state updates
   */
  public handleCartUpdate(cartState: CartState): void {
    // Update order summary or handle empty cart
    if (cartState.isEmpty) {
      this.logger.warn('Cart is empty, redirecting to cart page');
      // Optionally redirect to cart page
    }
  }

  // ============================================================================
  // PAYMENT FORM MANAGEMENT — see payment-form-display.ts
  // ============================================================================

  /**
   * Initialize payment forms based on the checkout store state
   */
  public initializePaymentForms(): void {
    initializePaymentFormDisplay(this.paymentFormContext());
  }

  /**
   * Update payment form visibility based on selected payment method
   */
  public updatePaymentFormVisibility(paymentMethod: string): void {
    applyPaymentFormVisibility(this.paymentFormContext(), paymentMethod);
  }

  // ============================================================================
  // FLOATING LABEL MANAGEMENT — see floating-labels.ts
  // ============================================================================

  /**
   * Handle Spreedly field focus event
   */
  public handleSpreedlyFieldFocus(fieldName: 'number' | 'cvv'): void {
    focusSpreedlyLabel(this.floatingLabelContext(), fieldName);
  }

  /**
   * Handle Spreedly field blur event
   */
  public handleSpreedlyFieldBlur(
    fieldName: 'number' | 'cvv',
    hasValue: boolean
  ): void {
    blurSpreedlyLabel(this.floatingLabelContext(), fieldName, hasValue);
  }

  /**
   * Handle Spreedly field input event
   */
  public handleSpreedlyFieldInput(
    fieldName: 'number' | 'cvv',
    hasValue: boolean
  ): void {
    inputSpreedlyLabel(this.floatingLabelContext(), fieldName, hasValue);
  }

  /**
   * Set up floating label behavior for a specific field
   */
  public setupFloatingLabel(
    field: HTMLInputElement | HTMLSelectElement,
    label?: HTMLLabelElement
  ): void {
    setupFieldFloatingLabel(this.floatingLabelContext(), field, label);
  }

  /**
   * Update floating labels when form data is populated programmatically
   */
  public updateLabelsForPopulatedData(): void {
    refreshFloatingLabels(this.floatingLabelContext());
  }

  // ============================================================================
  // RESPONSIVE UI HANDLING
  // ============================================================================

  /**
   * Handle responsive UI adjustments
   */
  public handleResponsiveUI(): void {
    applyResponsiveUI(this.floatingLabelContext());
  }

  // ============================================================================
  // ACCESSIBILITY FEATURES
  // ============================================================================

  /**
   * Enhance accessibility features
   */
  public enhanceAccessibility(): void {
    enhanceFieldAccessibility(this.fieldErrorContext());
  }

  // ============================================================================
  // CLEANUP AND DESTRUCTION
  // ============================================================================

  /**
   * Clean up event listeners and restore original state
   */
  public destroy(): void {
    // Clear periodic check
    if (this.periodicCheck.value) {
      clearInterval(this.periodicCheck.value);
      this.periodicCheck.value = undefined;
    }

    // Remove all event handlers using EventHandlerManager
    this.eventManager.removeAllHandlers();

    // Clear maps
    this.floatingLabels.clear();
    this.loadingStates.clear();

    this.logger.debug('UIService destroyed');
  }
}
