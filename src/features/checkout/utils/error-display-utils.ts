/**
 * Error Display Utilities - Consolidated error display management
 *
 * Reduces code duplication for error handling and display across services
 */

import { FieldFinder } from './field-finder-utils';

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

const DEFAULT_OPTIONS: ErrorDisplayOptions = {
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
 * Without it a message is an anonymous `<div>`, and clearing one field's error means
 * "remove the first error label inside this field's wrapper" — where the wrapper falls
 * back to the field's parent element when the page uses no wrapper classes. On such a
 * page the parent is the `<form>`, so blurring one field erased a *different* field's
 * message while leaving its red outline: an error the shopper can no longer read and
 * cannot clear. Stamping the owner makes clearing exact.
 */
const ERROR_OWNER_ATTR = 'data-next-error-for';

/** Any element carrying a checkout field name, in either convention. */
const CHECKOUT_FIELD_SELECTOR =
  '[data-next-checkout-field], [os-checkout-field]';

/**
 * Whether a container is narrow enough for "the error label in here" to mean one field.
 *
 * The question the old code asked instead was whether the container was the field's direct
 * parent, which is neither necessary nor sufficient: a `.form-group` wrapping one input
 * *is* its parent and is perfectly safe, while a container two levels up holding six
 * inputs is not. Counting the fields answers it directly, and covers the case that started
 * this — a page with no wrapper classes, where the container resolves to the whole form.
 */
function holdsOneFieldAtMost(container: Element): boolean {
  return container.querySelectorAll(CHECKOUT_FIELD_SELECTOR).length <= 1;
}

/** The name a field is known by, across both attribute conventions. */
function fieldKey(field: HTMLElement): string | null {
  return (
    field.getAttribute('data-next-checkout-field') ??
    field.getAttribute('os-checkout-field') ??
    field.getAttribute('name')
  );
}

/**
 * The containers an unstamped message could belong to this field from.
 *
 * Three, because where a label sits depends on the author's markup: the wrapper the SDK
 * styles, a `.form-group` ancestor, or a `.form-input` one. Missing one leaves a stale
 * error under a field the shopper has already corrected.
 */
function messageContainers(field: HTMLElement): Element[] {
  const found = [
    FieldFinder.findFieldWrapper(field),
    field.closest(`.${DEFAULT_WRAPPER_CLASS}`),
    field.closest('.form-input'),
  ].filter((container): container is Element => container !== null);

  return [...new Set(found)];
}

/**
 * This field's error messages, wherever the markup put them.
 *
 * The one place that answers "whose message is this", for every caller that shows, clears
 * or counts one. Two passes, because a message may or may not name its owner:
 *
 * - **stamped** with {@link ERROR_OWNER_ATTR} — the SDK wrote it, so it is found anywhere
 *   in the form, including a container shared with other fields.
 * - **unstamped** — page markup, or a field with no name to stamp. Claimed only from a
 *   container holding this field alone, so clearing one field cannot take another's
 *   message with it.
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
  // The form when there is one, the document when there is not: a billing field cloned
  // into a `data-next-component` block can sit outside the `<form>`, and a message that
  // cannot be found is a message that stays on screen after the shopper fixes the field.
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
  private options: ErrorDisplayOptions;

  constructor(options: ErrorDisplayOptions = {}) {
    this.options = { ...DEFAULT_OPTIONS, ...options };
  }

  /**
   * Show error on a field with consistent styling
   */
  showFieldError(field: HTMLElement, message: string): void {
    const wrapper = FieldFinder.findFieldWrapper(field);
    if (!wrapper) return;

    // Remove any existing error
    this.clearFieldError(field);

    // Add error styling to field
    field.classList.add('has-error', this.options.errorClass!);
    field.classList.remove(this.options.successClass!);

    // Add error styling to wrapper
    wrapper.classList.add(this.options.iconErrorClass!);
    wrapper.classList.remove(this.options.iconSuccessClass!);

    // Create and append error label
    const errorElement = document.createElement('div');
    errorElement.className = this.options.errorLabelClass!;
    const key = fieldKey(field);
    if (key) errorElement.setAttribute(ERROR_OWNER_ATTR, key);
    errorElement.textContent = message;
    errorElement.setAttribute('role', 'alert');
    errorElement.setAttribute('aria-live', 'polite');

    // Append to appropriate container
    const formGroup = field.closest(`.${this.options.wrapperClass}`);
    if (formGroup) {
      formGroup.appendChild(errorElement);
    } else {
      wrapper.appendChild(errorElement);
    }
  }

  /**
   * Clear error from a field
   *
   * The classes go whether or not a wrapper was found, and the messages are whichever
   * {@link fieldMessages} says are this field's — never "the first label nearby".
   */
  clearFieldError(field: HTMLElement): void {
    field.classList.remove('has-error', this.options.errorClass!);
    FieldFinder.findFieldWrapper(field)?.classList.remove(
      this.options.iconErrorClass!
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
    field.classList.add(this.options.successClass!);

    if (wrapper) {
      wrapper.classList.add(this.options.iconSuccessClass!);
    }
  }

  /**
   * Clear all error displays in a container
   */
  clearAllErrors(container: HTMLElement): void {
    // Remove all error labels
    const errorLabels = container.querySelectorAll(
      `.${this.options.errorLabelClass}`
    );
    errorLabels.forEach(label => label.remove());

    // Remove error classes from fields
    const errorFields = container.querySelectorAll(
      `.${this.options.errorClass}, .has-error`
    );
    errorFields.forEach(field => {
      field.classList.remove('has-error', this.options.errorClass!);
    });

    // Remove error icons from wrappers
    const errorWrappers = container.querySelectorAll(
      `.${this.options.iconErrorClass}`
    );
    errorWrappers.forEach(wrapper => {
      wrapper.classList.remove(this.options.iconErrorClass!);
    });
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
   * Find a field by name within a container
   */
  private findField(
    fieldName: string,
    container: HTMLElement
  ): HTMLElement | null {
    const selectors = [
      `[data-next-checkout-field="${fieldName}"]`,
      `[os-checkout-field="${fieldName}"]`,
      `[name="${fieldName}"]`,
      `#${fieldName}`,
    ];

    for (const selector of selectors) {
      const field = container.querySelector(selector);
      if (field) return field as HTMLElement;
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
