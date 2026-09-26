/**
 * Error Display Utilities - Consolidated error display management
 *
 * Reduces code duplication for error handling and display across services
 */

import { FieldFinder } from './field-finder-utils';
import {
  checkoutFieldNames,
  sdkCheckoutFieldName,
} from '@/utils/checkout-field-names';

export interface ErrorDisplayOptions {
  wrapperClass?: string;
  errorClass?: string;
  errorLabelClass?: string;
  successClass?: string;
  iconErrorClass?: string;
  iconSuccessClass?: string;
}

/** Named separately: the two the message lookup needs without an instance to ask. */
const DEFAULT_WRAPPER_CLASS = 'form-group';
const DEFAULT_LABEL_CLASS = 'next-error-label';

const DEFAULT_OPTIONS: Required<ErrorDisplayOptions> = {
  wrapperClass: DEFAULT_WRAPPER_CLASS,
  errorClass: 'next-error-field',
  errorLabelClass: DEFAULT_LABEL_CLASS,
  successClass: 'no-error',
  iconErrorClass: 'addErrorIcon',
  iconSuccessClass: 'addTick',
};

/**
 * Marks an error message as belonging to one field.
 *
 * Without it, clearing means "remove the first label in this field's wrapper" — and that
 * wrapper falls back to the `<form>` on a page with no wrapper classes, so one field's
 * blur erased another's message and left its red outline behind.
 */
const ERROR_OWNER_ATTR = 'data-next-error-for';

/** Any element carrying a checkout field name, in either convention. */
const CHECKOUT_FIELD_SELECTOR =
  '[data-next-checkout-field], [os-checkout-field]';

/**
 * Whether a container is narrow enough for "the error label in here" to mean one field.
 *
 * Counted rather than inferred from being the field's parent: a container two levels up
 * holding six inputs is a parent too.
 */
function holdsOneFieldAtMost(container: Element): boolean {
  return container.querySelectorAll(CHECKOUT_FIELD_SELECTOR).length <= 1;
}

/**
 * The name a field is known by. The same four ways {@link ErrorDisplayManager.findField}
 * looks one up, `id` included: a field found by id but not stampable by it got an unowned
 * message, and an unowned message in a container holding other fields can never be cleared.
 */
function fieldKey(field: HTMLElement): string | null {
  const name =
    field.getAttribute('data-next-checkout-field') ??
    field.getAttribute('os-checkout-field') ??
    field.getAttribute('name') ??
    (field.id || null);
  return name === null ? null : sdkCheckoutFieldName(name);
}

/** Where a label can sit, which depends on the author's markup. Missing one leaves a stale error. */
function messageContainers(field: HTMLElement): Element[] {
  const found = [
    FieldFinder.findFieldWrapper(field),
    field.closest(`.${DEFAULT_WRAPPER_CLASS}`),
    field.closest('.form-input'),
  ].filter((container): container is Element => container !== null);

  return [...new Set(found)];
}

/**
 * This field's error messages, wherever the markup put them. The one place that answers
 * "whose message is this", for every caller that shows, clears or counts one.
 *
 * - **stamped** with {@link ERROR_OWNER_ATTR} — found anywhere in the form.
 * - **unstamped** — page markup; claimed only from a container holding this field alone.
 *
 * @example
 * ```ts
 * fieldMessages(phoneInput).forEach(message => message.remove());
 * ```
 */
export function fieldMessages(
  field: HTMLElement,
  labelClass: string = DEFAULT_LABEL_CLASS
): Element[] {
  const key = fieldKey(field);
  // Document when there is no form: a billing field cloned into a `data-next-component`
  // block can sit outside it.
  const scope: ParentNode = field.closest('form') ?? field.ownerDocument;

  const stamped = key
    ? scope.querySelectorAll(
        `.${labelClass}[${ERROR_OWNER_ATTR}="${CSS.escape(key)}"]`
      )
    : [];

  const unstamped = messageContainers(field)
    .filter(holdsOneFieldAtMost)
    .map(container =>
      container.querySelector(`.${labelClass}:not([${ERROR_OWNER_ATTR}])`)
    )
    .filter((label): label is Element => label !== null);

  return [...new Set([...stamped, ...unstamped])];
}

export class ErrorDisplayManager {
  /** `Required`: the constructor fills every one from {@link DEFAULT_OPTIONS}. */
  private options: Required<ErrorDisplayOptions>;

  constructor(options: ErrorDisplayOptions = {}) {
    this.options = { ...DEFAULT_OPTIONS, ...options };
  }

  /**
   * Shows a message under a field and marks the field itself.
   *
   * The field's own classes go on with or without a wrapper, matching
   * {@link ErrorDisplayManager.clearFieldError}, which takes them off either way.
   */
  showFieldError(field: HTMLElement, message: string): void {
    this.clearFieldError(field);

    field.classList.add('has-error', this.options.errorClass);
    field.classList.remove(this.options.successClass);

    const wrapper = FieldFinder.findFieldWrapper(field);
    wrapper?.classList.add(this.options.iconErrorClass);
    wrapper?.classList.remove(this.options.iconSuccessClass);

    const errorElement = document.createElement('div');
    errorElement.className = this.options.errorLabelClass;
    const key = fieldKey(field);
    if (key) errorElement.setAttribute(ERROR_OWNER_ATTR, key);
    errorElement.textContent = message;
    errorElement.setAttribute('role', 'alert');
    errorElement.setAttribute('aria-live', 'polite');

    // The stamp is what makes the message findable, so the nearest container will do.
    const container = field.closest(`.${this.options.wrapperClass}`) ?? wrapper;
    container?.appendChild(errorElement);
  }

  /**
   * Clear error from a field
   *
   * The classes go whether or not a wrapper was found, and the messages are whichever
   * {@link fieldMessages} says are this field's — never "the first label nearby".
   */
  clearFieldError(field: HTMLElement): void {
    field.classList.remove('has-error', this.options.errorClass);
    FieldFinder.findFieldWrapper(field)?.classList.remove(
      this.options.iconErrorClass
    );

    fieldMessages(field, this.options.errorLabelClass).forEach(message =>
      message.remove()
    );
  }

  /**
   * Show field as valid with success styling
   */
  showFieldValid(field: HTMLElement): void {
    const wrapper = FieldFinder.findFieldWrapper(field);

    // Clear any errors first
    this.clearFieldError(field);

    // Add success styling
    field.classList.add(this.options.successClass);

    if (wrapper) {
      wrapper.classList.add(this.options.iconSuccessClass);
    }
  }

  /**
   * Returns every field in `container` to the state it had before anything was judged.
   *
   * Success marks included, or a field keeps a tick it has not just earned.
   */
  clearAllErrors(container: HTMLElement): void {
    container
      .querySelectorAll(`.${this.options.errorLabelClass}`)
      .forEach(label => label.remove());

    container
      .querySelectorAll(
        `.${this.options.errorClass}, .has-error, .${this.options.successClass}`
      )
      .forEach(field =>
        field.classList.remove(
          'has-error',
          this.options.errorClass,
          this.options.successClass
        )
      );

    container
      .querySelectorAll(
        `.${this.options.iconErrorClass}, .${this.options.iconSuccessClass}`
      )
      .forEach(wrapper =>
        wrapper.classList.remove(
          this.options.iconErrorClass,
          this.options.iconSuccessClass
        )
      );
  }

  /**
   * Display multiple field errors at once
   */
  displayErrors(errors: Record<string, string>, container: HTMLElement): void {
    // Clear existing errors first
    this.clearAllErrors(container);

    // Display each error
    Object.entries(errors).forEach(([fieldName, message]) => {
      const field = this.findField(fieldName, container);
      if (field) {
        this.showFieldError(field, message);
      }
    });
  }

  /**
   * Finds a field by name within a container, in whichever convention the page uses.
   *
   * Escaped: a name is page data, and an id beginning with a digit throws unescaped.
   */
  private findField(
    fieldName: string,
    container: HTMLElement
  ): HTMLElement | null {
    const name = CSS.escape(fieldName);
    const selectors = [
      ...checkoutFieldNames(fieldName).map(
        alias => `[data-next-checkout-field="${CSS.escape(alias)}"]`
      ),
      `[os-checkout-field="${name}"]`,
      `[name="${name}"]`,
      `#${name}`,
    ];

    for (const selector of selectors) {
      const field = container.querySelector(selector);
      if (field instanceof HTMLElement) return field;
    }

    return null;
  }

  /**
   * Show a toast error message
   */
  static showToastError(message: string, duration: number = 10000): void {
    const toastHandler = document.querySelector(
      '[next-checkout-element="spreedly-error"]'
    );
    if (!(toastHandler instanceof HTMLElement)) return;

    const messageElement = toastHandler.querySelector(
      '[data-os-message="error"]'
    );
    if (messageElement instanceof HTMLElement) {
      messageElement.textContent = message;
      toastHandler.style.display = 'flex';

      // Auto-hide after duration
      setTimeout(() => {
        if (toastHandler.style.display === 'flex') {
          toastHandler.style.display = 'none';
        }
      }, duration);
    }
  }

  /**
   * Hide toast error message
   */
  static hideToastError(): void {
    const toastHandler = document.querySelector(
      '[next-checkout-element="spreedly-error"]'
    );
    if (toastHandler instanceof HTMLElement) {
      toastHandler.style.display = 'none';
    }
  }
}
