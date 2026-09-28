/**
 * The card fields on the checkout form: their classes, error labels, floating labels and
 * the `add_payment_info` event. NextPayment draws the hosted number and CVV and
 * tokenizes them — see `./card-tokenizer`.
 */

import { createLogger } from '@/core/logger';
import { FieldFinder } from '../utils/field-finder-utils';
import {
  NextPaymentTokenizer,
  translatedCardText,
  type CardError,
  type CardTextKey,
  type HostedCardField,
  type HostedFieldState,
} from './card-tokenizer';
import {
  hideAllPaymentErrors,
  resolvePaymentErrorTarget,
  showPaymentErrorTarget,
} from '../utils/payment-error-container';
import type { Logger } from '@/core/logger';
import { useCheckoutStore } from '@/state/checkout';
import { nextAnalytics, EcommerceEvents } from '@/core/analytics/index';
import { paymentMethodLabel } from '@/utils/payment-method';
import type { CardInputConfig } from '@/types/global';

import type { CardHolderData } from './card-tokenizer';

export type CreditCardData = CardHolderData;

/** The checkout store's error keys for each hosted field, cleared as the shopper types. */
const STORE_ERROR_KEYS: Record<HostedCardField, readonly string[]> = {
  number: ['cc-number', 'card_number'],
  cvv: ['cvv', 'card_cvv'],
};

/** A translation of `key` when one is loaded, else the English this form always showed. */
const text = (key: CardTextKey, english: string): string =>
  translatedCardText(key) ?? english;

export interface CreditCardValidationState {
  number: { isValid: boolean; hasError: boolean; errorMessage?: string };
  cvv: { isValid: boolean; hasError: boolean; errorMessage?: string };
  month: { isValid: boolean; hasError: boolean; errorMessage?: string };
  year: { isValid: boolean; hasError: boolean; errorMessage?: string };
}

export class CreditCardService {
  private logger: Logger;
  private config?: CardInputConfig;
  private tokenizer: NextPaymentTokenizer;
  private isReady: boolean = false;
  private validationState: CreditCardValidationState;

  // Callbacks
  private onReadyCallback?: () => void;
  private onErrorCallback?: (errors: string[]) => void;
  private onTokenCallback?: (token: string, pmData: any) => void;

  // Field references
  private numberField?: HTMLElement;
  private cvvField?: HTMLElement;
  private monthField?: HTMLElement;
  private yearField?: HTMLElement;

  // Track if we've fired the add_payment_info event
  private hasTrackedPaymentInfo = false;

  // Floating label callbacks
  private onFieldFocusCallback?: (fieldName: 'number' | 'cvv') => void;
  private onFieldBlurCallback?: (
    fieldName: 'number' | 'cvv',
    hasValue: boolean
  ) => void;
  private onFieldInputCallback?: (
    fieldName: 'number' | 'cvv',
    hasValue: boolean
  ) => void;

  // Track field value states for floating labels
  private fieldHasValue: { number: boolean; cvv: boolean } = {
    number: false,
    cvv: false,
  };

  // Store original placeholders for restoration
  private originalPlaceholders: { number: string; cvv: string } = {
    number: 'Card Number',
    cvv: 'CVV *',
  };
  private labelBehavior: { number: string | null; cvv: string | null } = {
    number: null,
    cvv: null,
  };

  /**
   * Holds every listener this service puts on the checkout form's own markup — the
   * `change` on each expiry select and the `click` on the two hosted card fields and
   * their wrappers.
   *
   * All six were inline arrows, which `removeEventListener` can never be handed back,
   * and the form builds a fresh service on every init: each one added another generation
   * to the same four elements. {@link destroy}
   * aborts it. Nothing here concerns the provider's own callbacks, which the tokenizer
   * holds.
   */
  private listenerAbort = new AbortController();

  constructor(environmentKey: string, config?: CardInputConfig) {
    this.config = config;
    this.logger = createLogger('CreditCardService');
    this.validationState = this.initializeValidationState();
    this.tokenizer = new NextPaymentTokenizer(environmentKey, config);

    if (!environmentKey) {
      this.logger.error('No payment environment key provided');
      return;
    }

    this.logger.debug('CreditCardService created');
  }

  /**
   * Initialize the credit card service
   */
  public async initialize(): Promise<void> {
    try {
      // Skip if already initialized
      if (this.isReady) {
        this.logger.debug('CreditCardService already initialized, skipping');
        return;
      }

      // Find credit card fields
      this.findCreditCardFields();

      if (!this.numberField || !this.cvvField) {
        this.logger.debug(
          'Credit card fields not found, skipping hosted field initialization'
        );
        return;
      }

      await this.mountHostedFields();

      this.logger.debug('CreditCardService initialized successfully');
    } catch (error) {
      this.logger.error('Failed to initialize CreditCardService:', error);
      throw error;
    }
  }

  /**
   * Tokenize credit card data
   */
  public async tokenizeCard(cardData: CreditCardData): Promise<string> {
    if (!this.isReady) {
      throw new Error('Credit card service is not ready');
    }

    // Validate card data
    if (!cardData.full_name || !cardData.month || !cardData.year) {
      throw new Error('Credit card data is incomplete');
    }

    this.logger.debug('Tokenizing credit card');

    return new Promise((resolve, reject) => {
      // Set up one-time callbacks
      const originalTokenCallback = this.onTokenCallback;
      const originalErrorCallback = this.onErrorCallback;

      this.onTokenCallback = (token: string, pmData: any) => {
        // Call the original callback first (to emit the event)
        if (originalTokenCallback) {
          originalTokenCallback(token, pmData);
        }
        // Then restore and resolve
        if (originalTokenCallback) {
          this.onTokenCallback = originalTokenCallback;
        } else {
          delete this.onTokenCallback;
        }
        if (originalErrorCallback) {
          this.onErrorCallback = originalErrorCallback;
        } else {
          delete this.onErrorCallback;
        }
        resolve(token);
      };

      this.onErrorCallback = (errors: string[]) => {
        // Call the original callback first (to emit the error event)
        if (originalErrorCallback) {
          originalErrorCallback(errors);
        }
        // Then restore and reject
        if (originalTokenCallback) {
          this.onTokenCallback = originalTokenCallback;
        } else {
          delete this.onTokenCallback;
        }
        if (originalErrorCallback) {
          this.onErrorCallback = originalErrorCallback;
        } else {
          delete this.onErrorCallback;
        }
        reject(new Error(errors.join('. ')));
      };

      // Set timeout
      const timeoutId = setTimeout(() => {
        if (originalTokenCallback) {
          this.onTokenCallback = originalTokenCallback;
        } else {
          delete this.onTokenCallback;
        }
        if (originalErrorCallback) {
          this.onErrorCallback = originalErrorCallback;
        } else {
          delete this.onErrorCallback;
        }
        reject(new Error('Credit card tokenization timed out'));
      }, 30000);

      // Clear timeout on resolution
      const originalResolve = resolve;
      const originalReject = reject;
      const wrappedResolve = (value: string | PromiseLike<string>) => {
        clearTimeout(timeoutId);
        originalResolve(value as string);
      };
      // Override resolve with wrapped version
      resolve = wrappedResolve as any;
      reject = (error: Error) => {
        clearTimeout(timeoutId);
        originalReject(error);
      };

      // `logger.debug('Tokenizing credit card')` above covers this call; a raw
      // `console.log` here printed `cardData` on every production checkout, because
      // nothing routed through `Logger` gates it.
      this.tokenizer.tokenize(cardData);
    });
  }

  /**
   * Validate credit card form data
   */
  public validateCreditCard(cardData: CreditCardData): {
    isValid: boolean;
    errors?: Record<string, string>;
  } {
    const errors: Record<string, string> = {};
    let isValid = true;

    // Determine the actual field names used in the DOM
    const monthFieldName =
      this.monthField?.getAttribute('data-next-checkout-field') ||
      this.monthField?.getAttribute('os-checkout-field') ||
      'cc-month';
    const yearFieldName =
      this.yearField?.getAttribute('data-next-checkout-field') ||
      this.yearField?.getAttribute('os-checkout-field') ||
      'cc-year';

    // Validate month
    if (!cardData.month || cardData.month.trim() === '') {
      const message = text(
        'payment.card.expiry_month.errors.blank',
        'Expiration month is required'
      );
      errors[monthFieldName] = message;
      this.setCreditCardFieldError('month', message);
      isValid = false;
    } else {
      const monthNum = parseInt(cardData.month, 10);
      if (monthNum < 1 || monthNum > 12) {
        const message = text(
          'payment.card.expiry_month.errors.invalid',
          'Please select a valid month'
        );
        errors[monthFieldName] = message;
        this.setCreditCardFieldError('month', message);
        isValid = false;
      } else {
        this.setCreditCardFieldValid('month');
      }
    }

    // Validate year
    if (!cardData.year || cardData.year.trim() === '') {
      const message = text(
        'payment.card.expiry_year.errors.blank',
        'Expiration year is required'
      );
      errors[yearFieldName] = message;
      this.setCreditCardFieldError('year', message);
      isValid = false;
    } else {
      const currentDate = new Date();
      const currentYear = currentDate.getFullYear();
      const currentMonth = currentDate.getMonth() + 1; // JavaScript months are 0-based
      const yearNum = parseInt(cardData.year, 10);
      const fullYear = yearNum < 100 ? 2000 + yearNum : yearNum;

      if (fullYear < currentYear || fullYear > currentYear + 20) {
        const message = text(
          'payment.card.expiry_year.errors.invalid',
          'Please select a valid year'
        );
        errors[yearFieldName] = message;
        this.setCreditCardFieldError('year', message);
        isValid = false;
      } else if (fullYear === currentYear && cardData.month) {
        // Check if card is expired (year is current year and month is in the past)
        const monthNum = parseInt(cardData.month, 10);
        if (monthNum < currentMonth) {
          const message = text(
            'payment.card.expiry_month.errors.expired',
            'Card has expired'
          );
          errors[monthFieldName] = message;
          errors[yearFieldName] = message;
          this.setCreditCardFieldError('month', message);
          this.setCreditCardFieldError('year', message);
          isValid = false;
        } else {
          this.setCreditCardFieldValid('year');
        }
      } else {
        this.setCreditCardFieldValid('year');
      }
    }

    const result: { isValid: boolean; errors?: Record<string, string> } = {
      isValid,
    };
    if (Object.keys(errors).length > 0) {
      result.errors = errors;
    }
    return result;
  }

  /**
   * Check if Spreedly fields are ready for validation
   */
  public checkSpreedlyFieldsReady(): {
    hasEmptyFields: boolean;
    errors: Array<{ field: string; message: string }>;
  } {
    const errors: Array<{ field: string; message: string }> = [];

    // Check if Spreedly fields have been interacted with and are valid
    if (!this.validationState.number.isValid) {
      errors.push({
        field: 'number',
        message: text(
          'payment.card.number.errors.invalid',
          'Please enter a valid credit card number'
        ),
      });
    }

    if (!this.validationState.cvv.isValid) {
      errors.push({
        field: 'cvv',
        message: text(
          'payment.card.cvv.errors.invalid',
          'Please enter a valid CVV'
        ),
      });
    }

    return {
      hasEmptyFields: errors.length > 0,
      errors,
    };
  }

  /**
   * Clear all credit card errors
   */
  public clearAllErrors(): void {
    // Clear Spreedly field errors
    this.clearCreditCardFieldError('number');
    this.clearCreditCardFieldError('cvv');
    this.clearCreditCardFieldError('month');
    this.clearCreditCardFieldError('year');

    // Hide error containers - this is called after successful tokenization
    // so it's safe to hide payment errors here
    this.hidePaymentErrorContainers();
  }

  /**
   * Clear credit card fields
   */
  public clearFields(): void {
    if (this.isReady) this.tokenizer.reset();

    // Clear month and year fields
    if (this.monthField instanceof HTMLSelectElement) {
      this.monthField.selectedIndex = 0;
    }
    if (this.yearField instanceof HTMLSelectElement) {
      this.yearField.selectedIndex = 0;
    }

    // Clear validation state
    this.validationState = this.initializeValidationState();

    // Clear any visible errors
    this.clearAllErrors();
  }

  private hidePaymentErrorContainers(): void {
    // Every payment error container, not only the card's: a decline the shopper
    // has now fixed should not be left on screen under another method's heading.
    hideAllPaymentErrors();
  }

  /**
   * Set callbacks
   */
  public setOnReady(callback: () => void): void {
    this.onReadyCallback = callback;
    if (this.isReady) callback();
  }

  public setOnError(callback: (errors: string[]) => void): void {
    this.onErrorCallback = callback;
  }

  public setOnToken(callback: (token: string, pmData: any) => void): void {
    this.onTokenCallback = callback;
  }

  /**
   * Set floating label callbacks
   */
  public setFloatingLabelCallbacks(
    onFocus: (fieldName: 'number' | 'cvv') => void,
    onBlur: (fieldName: 'number' | 'cvv', hasValue: boolean) => void,
    onInput: (fieldName: 'number' | 'cvv', hasValue: boolean) => void
  ): void {
    this.onFieldFocusCallback = onFocus;
    this.onFieldBlurCallback = onBlur;
    this.onFieldInputCallback = onInput;
  }

  /**
   * Check if service is ready
   */
  public get ready(): boolean {
    return this.isReady;
  }

  /** Focuses a hosted field; the page cannot reach into the provider's iframe itself. */
  public focusField(field: HostedCardField): void {
    if (!this.isReady) return;
    this.tokenizer.focus(field);
    this.logger.debug(`Focusing ${field} field`);
  }

  // Private methods

  private initializeValidationState(): CreditCardValidationState {
    return {
      number: { isValid: false, hasError: false },
      cvv: { isValid: false, hasError: false },
      month: { isValid: false, hasError: false },
      year: { isValid: false, hasError: false },
    };
  }

  private findCreditCardFields(): void {
    // Find credit card number field
    const numberField =
      FieldFinder.findField('cc-number') ||
      document.getElementById('spreedly-number');
    if (numberField) {
      this.numberField = numberField;
      // Check label behavior for floating label placeholder mode
      this.labelBehavior.number = numberField.getAttribute(
        'data-label-behavior'
      );
    }

    // Find CVV field
    const cvvField =
      FieldFinder.findField('cvv') || document.getElementById('spreedly-cvv');
    if (cvvField) {
      this.cvvField = cvvField;
      // Check label behavior for floating label placeholder mode
      this.labelBehavior.cvv = cvvField.getAttribute('data-label-behavior');
    }

    // Find month field
    const monthField =
      FieldFinder.findField('cc-month') || FieldFinder.findField('exp-month');
    if (monthField) {
      this.monthField = monthField;
      // Add event listener to check payment info when month changes
      if (monthField instanceof HTMLSelectElement) {
        monthField.addEventListener(
          'change',
          () => this.checkAndTrackPaymentInfo(),
          { signal: this.listenerAbort.signal }
        );
      }
    }

    // Find year field
    const yearField =
      FieldFinder.findField('cc-year') || FieldFinder.findField('exp-year');
    if (yearField) {
      this.yearField = yearField;
      // Add event listener to check payment info when year changes
      if (yearField instanceof HTMLSelectElement) {
        yearField.addEventListener(
          'change',
          () => this.checkAndTrackPaymentInfo(),
          { signal: this.listenerAbort.signal }
        );
      }
    }

    this.logger.debug('Credit card fields found:', {
      number: !!this.numberField,
      cvv: !!this.cvvField,
      month: !!this.monthField,
      year: !!this.yearField,
    });
  }

  /**
   * Gives the two containers the ids NextPayment mounts into, and mounts it. The
   * `spreedly-*` ids and `data-spreedly` are the names templates' CSS and the floating
   * labels already select, so they stay.
   */
  private async mountHostedFields(): Promise<void> {
    if (this.numberField) {
      this.numberField.id = 'spreedly-number';
      this.numberField.setAttribute('data-spreedly', 'number');
      this.numberField.classList.add('spreedly-field-transition');
    }
    if (this.cvvField) {
      this.cvvField.id = 'spreedly-cvv';
      this.cvvField.setAttribute('data-spreedly', 'cvv');
      this.cvvField.classList.add('spreedly-field-transition');
    }

    this.originalPlaceholders = {
      number:
        this.config?.placeholders?.number ??
        text('payment.card.number.placeholder', 'Card Number'),
      cvv:
        this.config?.placeholders?.cvv ??
        text('payment.card.cvv.placeholder', 'CVV *'),
    };

    await this.tokenizer.mount(
      {
        numberId: 'spreedly-number',
        cvvId: 'spreedly-cvv',
        labels: {
          number:
            this.config?.labels?.number ??
            text('payment.card.number.label', 'Card Number'),
          cvv:
            this.config?.labels?.cvv ??
            text('payment.card.cvv.label', 'Security Code'),
        },
        placeholders: { ...this.originalPlaceholders },
        titles: {
          number:
            this.config?.titles?.number ??
            text('payment.card.number.title', 'Enter your card number'),
          cvv:
            this.config?.titles?.cvv ??
            text('payment.card.cvv.title', 'Enter your Security Code'),
        },
      },
      {
        onReady: () => {
          this.isReady = true;
          this.onReadyCallback?.();
        },
        onFieldState: state => this.handleFieldState(state),
        onError: errors => this.handleTokenizeErrors(errors),
        onToken: (token, paymentMethod) => {
          this.clearAllErrors();
          if (this.onTokenCallback) {
            this.onTokenCallback(token, paymentMethod);
          } else {
            this.logger.error('[CreditCard] No onTokenCallback registered!');
          }
        },
      }
    );

    this.setupFieldClickHandlers();
  }

  /** A failed attempt: each error in the form's language when one is loaded. */
  private handleTokenizeErrors(errors: CardError[]): void {
    const messages = errors.map(e => text(e.textKey, e.message));
    this.onErrorCallback?.(messages);
    this.showTokenizeErrors(messages);
  }

  private setupFieldClickHandlers(): void {
    // Add click handler to credit card number field container
    if (this.numberField) {
      // Find the wrapper or use the field itself
      const numberWrapper =
        this.numberField.closest(
          '.frm-flds, .form-group, .form-field, .field-group'
        ) || this.numberField;

      numberWrapper.addEventListener(
        'click',
        event => {
          // Don't transfer focus if clicking on another input
          const target = event.target as HTMLElement;
          if (
            target.tagName !== 'INPUT' &&
            target.tagName !== 'SELECT' &&
            target.tagName !== 'TEXTAREA'
          ) {
            this.focusField('number');
          }
        },
        { signal: this.listenerAbort.signal }
      );

      // Also add to the field itself for direct clicks
      this.numberField.addEventListener(
        'click',
        () => {
          this.focusField('number');
        },
        { signal: this.listenerAbort.signal }
      );
    }

    // Add click handler to CVV field container
    if (this.cvvField) {
      // Find the wrapper or use the field itself
      const cvvWrapper =
        this.cvvField.closest(
          '.frm-flds, .form-group, .form-field, .field-group'
        ) || this.cvvField;

      cvvWrapper.addEventListener(
        'click',
        event => {
          // Don't transfer focus if clicking on another input
          const target = event.target as HTMLElement;
          if (
            target.tagName !== 'INPUT' &&
            target.tagName !== 'SELECT' &&
            target.tagName !== 'TEXTAREA'
          ) {
            this.focusField('cvv');
          }
        },
        { signal: this.listenerAbort.signal }
      );

      // Also add to the field itself for direct clicks
      this.cvvField.addEventListener(
        'click',
        () => {
          this.focusField('cvv');
        },
        { signal: this.listenerAbort.signal }
      );
    }
  }

  private handleFieldState(state: HostedFieldState): void {
    const { field } = state;
    const usesPlaceholder =
      this.isReady && this.labelBehavior[field] === 'placeholder';

    if (state.action === 'focus') {
      this.handleFieldFocus(field);
      // The label floats up over the field, so its placeholder would sit under it.
      if (usesPlaceholder) this.tokenizer.setPlaceholder(field, '');
      this.onFieldFocusCallback?.(field);
      return;
    }

    if (state.action === 'blur') {
      this.handleFieldBlur(field);
      const hasValue = this.fieldHasValue[field];
      if (usesPlaceholder && !hasValue) {
        this.tokenizer.setPlaceholder(field, this.originalPlaceholders[field]);
      }
      this.onFieldBlurCallback?.(field, hasValue);
      return;
    }

    if (state.action === 'validation') {
      if (state.hasValue !== undefined)
        this.fieldHasValue[field] = state.hasValue;
      if (state.valid !== undefined) {
        this.validationState[field].isValid = state.valid;
        this.validationState[field].hasError = !state.valid;
      }
      return;
    }

    this.clearCreditCardFieldError(field);
    const checkoutStore = useCheckoutStore.getState();
    STORE_ERROR_KEYS[field].forEach(key => checkoutStore.clearError(key));

    if (state.hasValue !== undefined) {
      this.fieldHasValue[field] = state.hasValue;
      if (usesPlaceholder) {
        if (state.hasValue) {
          this.tokenizer.setPlaceholder(field, '');
        } else if (
          !this.getFieldElement(field)?.classList.contains('next-focused')
        ) {
          this.tokenizer.setPlaceholder(
            field,
            this.originalPlaceholders[field]
          );
        }
      }
      this.onFieldInputCallback?.(field, state.hasValue);
    }

    if (state.valid !== undefined) {
      const wasValid = this.validationState[field].isValid;
      this.validationState[field].isValid = state.valid;
      this.validationState[field].hasError = !state.valid;

      const element = this.getFieldElement(field);
      if (state.valid) {
        element?.classList.add('no-error');
        element?.classList.remove('has-error', 'next-error-field');
      } else {
        element?.classList.remove('no-error');
      }

      if (wasValid !== state.valid) {
        this.logger.info(
          `[CreditCard] ${field} validation changed: ${wasValid} -> ${state.valid}`
        );
      }
    }

    this.checkAndTrackPaymentInfo();
  }

  /**
   * Check if credit card fields are complete and track add_payment_info event
   */
  private checkAndTrackPaymentInfo(): void {
    // Only track once per session
    if (this.hasTrackedPaymentInfo) {
      return;
    }

    // Check if both Spreedly fields are valid
    const spreedlyFieldsValid =
      this.validationState.number.isValid && this.validationState.cvv.isValid;

    // Check if month and year are filled (basic check)
    const monthValue =
      this.monthField instanceof HTMLSelectElement ? this.monthField.value : '';
    const yearValue =
      this.yearField instanceof HTMLSelectElement ? this.yearField.value : '';
    const expirationValid =
      monthValue && yearValue && monthValue !== '' && yearValue !== '';

    // If all credit card fields are valid/complete, track the event
    if (spreedlyFieldsValid && expirationValid) {
      try {
        nextAnalytics.track(
          EcommerceEvents.createAddPaymentInfoEvent(
            paymentMethodLabel('card_token')
          )
        );
        this.hasTrackedPaymentInfo = true;
        this.logger.info(
          'Tracked add_payment_info event - credit card fields complete'
        );
      } catch (error) {
        this.logger.warn('Failed to track add_payment_info event:', error);
      }
    }
  }

  private handleFieldFocus(fieldName: string): void {
    const field =
      fieldName === 'number'
        ? this.numberField
        : fieldName === 'cvv'
          ? this.cvvField
          : null;

    if (field) {
      // Add focus class to the field container
      field.classList.add('next-focused', 'has-focus');

      // Find and focus the wrapper/container
      const wrapper = field.closest(
        '.frm-flds, .form-group, .form-field, .field-group'
      );
      if (wrapper) {
        wrapper.classList.add('next-focused', 'has-focus');
      }

      // Find and add focus to parent containers that might have borders
      const parentContainer = field.closest(
        '.credit-card-field, .form-input-wrapper'
      );
      if (parentContainer) {
        parentContainer.classList.add('next-focused', 'has-focus');
      }

      this.logger.debug(`Field focused: ${fieldName}`);
    }
  }

  private handleFieldBlur(fieldName: string): void {
    const field =
      fieldName === 'number'
        ? this.numberField
        : fieldName === 'cvv'
          ? this.cvvField
          : null;

    if (field) {
      // Remove focus class from the field container
      field.classList.remove('next-focused', 'has-focus');

      // Find and remove focus from the wrapper/container
      const wrapper = field.closest(
        '.frm-flds, .form-group, .form-field, .field-group'
      );
      if (wrapper) {
        wrapper.classList.remove('next-focused', 'has-focus');
      }

      // Find and remove focus from parent containers
      const parentContainer = field.closest(
        '.credit-card-field, .form-input-wrapper'
      );
      if (parentContainer) {
        parentContainer.classList.remove('next-focused', 'has-focus');
      }

      this.logger.debug(`Field blurred: ${fieldName}`);
    }
  }

  private showTokenizeErrors(messages: string[]): void {
    this.logger.info('[CreditCard] Showing errors:', messages.length);

    const message = messages.join('. ');
    // A card is being tokenized, so the card is the method — resolved through the
    // shared rule rather than a `credit-error` lookup of its own, so a page that
    // names its card container anything else still gets the message.
    const target = resolvePaymentErrorTarget('credit-card', this.logger);
    if (!target) {
      this.logger.error(
        '[CreditCard] Could not find error container to display errors'
      );
      return;
    }

    target.text.textContent = message;
    showPaymentErrorTarget(target);
    this.logger.debug('[CreditCard] Error displayed');

    // Auto-hide after 10 seconds, unless a newer failure has replaced the text.
    setTimeout(() => {
      if (target.text.textContent !== message) return;
      target.container.style.display = 'none';
      target.container.classList.remove('visible');
      this.logger.debug('[CreditCard] Error auto-hidden after 10 seconds');
    }, 10000);
  }

  private setCreditCardFieldValid(
    fieldType: keyof CreditCardValidationState
  ): void {
    this.validationState[fieldType].isValid = true;
    this.validationState[fieldType].hasError = false;
    delete this.validationState[fieldType].errorMessage;

    const field = this.getFieldElement(fieldType);
    if (field) {
      field.classList.remove('has-error', 'next-error-field');
      field.classList.add('no-error');

      const wrapper = FieldFinder.findFieldWrapper(field);
      if (wrapper) {
        wrapper.classList.remove('has-error', 'addErrorIcon');
        wrapper.classList.add('addTick');
      }
    }
  }

  private setCreditCardFieldError(
    fieldType: keyof CreditCardValidationState,
    message: string
  ): void {
    this.validationState[fieldType].isValid = false;
    this.validationState[fieldType].hasError = true;
    this.validationState[fieldType].errorMessage = message;

    this.logger.debug(
      `[Spreedly] Setting error for field: ${fieldType} - ${message}`
    );

    // Map field types to actual DOM selectors
    let selector: string | null = null;
    if (fieldType === 'number') {
      selector = '[data-next-checkout-field="cc-number"], #spreedly-number';
    } else if (fieldType === 'cvv') {
      selector = '[data-next-checkout-field="cvv"], #spreedly-cvv';
    } else if (fieldType === 'month') {
      selector =
        '[data-next-checkout-field="cc-month"], [data-next-checkout-field="exp-month"]';
    } else if (fieldType === 'year') {
      selector =
        '[data-next-checkout-field="cc-year"], [data-next-checkout-field="exp-year"]';
    }

    if (!selector) {
      this.logger.warn(
        `[Spreedly] No selector found for field type: ${fieldType}`
      );
      return;
    }

    // Find all matching fields
    const fields = document.querySelectorAll(selector);
    fields.forEach(field => {
      if (field instanceof HTMLElement) {
        // Add error classes to the field itself
        field.classList.remove('no-error');
        field.classList.add('has-error', 'next-error-field');

        // Find the parent wrapper (could be .form-group, .frm-flds, etc.)
        const wrapper = field.closest('.form-group, .frm-flds, .field-group');
        if (wrapper) {
          wrapper.classList.remove('addTick');
          wrapper.classList.add('has-error', 'addErrorIcon');

          // Remove any existing error labels
          const existingErrors = wrapper.querySelectorAll('.next-error-label');
          existingErrors.forEach(error => error.remove());

          // Add new error message
          const errorElement = document.createElement('div');
          errorElement.className = 'next-error-label';
          errorElement.setAttribute('role', 'alert');
          errorElement.setAttribute('aria-live', 'polite');
          errorElement.textContent = message;
          wrapper.appendChild(errorElement);

          this.logger.debug(`[Spreedly] Added error label: ${message}`);
        }
      }
    });

    // Note: We don't show the general payment error container here
    // That's only for submission failures, not real-time validation
  }

  private clearCreditCardFieldError(
    fieldType: keyof CreditCardValidationState
  ): void {
    this.validationState[fieldType].hasError = false;
    delete this.validationState[fieldType].errorMessage;

    this.logger.debug(`[Spreedly] Clearing error for field: ${fieldType}`);

    // Map field types to actual DOM selectors
    let selector: string | null = null;
    if (fieldType === 'number') {
      selector = '[data-next-checkout-field="cc-number"], #spreedly-number';
    } else if (fieldType === 'cvv') {
      selector = '[data-next-checkout-field="cvv"], #spreedly-cvv';
    } else if (fieldType === 'month') {
      selector =
        '[data-next-checkout-field="cc-month"], [data-next-checkout-field="exp-month"]';
    } else if (fieldType === 'year') {
      selector =
        '[data-next-checkout-field="cc-year"], [data-next-checkout-field="exp-year"]';
    }

    if (!selector) {
      this.logger.warn(
        `[Spreedly] No selector found for field type: ${fieldType}`
      );
      return;
    }

    // Find all matching fields
    const fields = document.querySelectorAll(selector);
    fields.forEach(field => {
      if (field instanceof HTMLElement) {
        // Remove error classes from the field itself
        field.classList.remove('has-error', 'next-error-field');

        // Find the parent wrapper (could be .form-group, .frm-flds, etc.)
        const wrapper = field.closest('.form-group, .frm-flds, .field-group');
        if (wrapper) {
          wrapper.classList.remove('has-error', 'addErrorIcon');

          // Remove any error labels within the wrapper
          const errorLabels = wrapper.querySelectorAll(
            '.next-error-label, .error-message, [role="alert"]'
          );
          errorLabels.forEach(label => {
            this.logger.debug(
              `[Spreedly] Removing error label: ${label.textContent}`
            );
            label.remove();
          });
        }
      }
    });

    // Note: We don't hide payment error containers here because those are for
    // backend payment failures, not field validation errors
  }

  private getFieldElement(
    fieldType: keyof CreditCardValidationState
  ): HTMLElement | undefined {
    switch (fieldType) {
      case 'number':
        return this.numberField;
      case 'cvv':
        return this.cvvField;
      case 'month':
        return this.monthField;
      case 'year':
        return this.yearField;
      default:
        return undefined;
    }
  }

  public destroy(): void {
    this.listenerAbort.abort();
    this.tokenizer.destroy();
    this.clearAllErrors();
    this.isReady = false;
    delete this.onReadyCallback;
    delete this.onErrorCallback;
    delete this.onTokenCallback;
    this.logger.debug('CreditCardService destroyed');
  }
}
