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

const DEFAULT_OPTIONS: ErrorDisplayOptions = {
  wrapperClass: 'form-group',
  errorClass: 'next-error-field',
  errorLabelClass: 'next-error-label',
  successClass: 'no-error',
  iconErrorClass: 'addErrorIcon',
  iconSuccessClass: 'addTick'
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
export const ERROR_OWNER_ATTR = 'data-next-error-for';

/** The name a field is known by, across both attribute conventions. */
export function fieldKey(field: HTMLElement): string | null {
  return (
    field.getAttribute('data-next-checkout-field') ??
    field.getAttribute('os-checkout-field') ??
    field.getAttribute('name')
  );
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
   */
  clearFieldError(field: HTMLElement): void {
    const wrapper = FieldFinder.findFieldWrapper(field);

    // Remove error classes from field
    field.classList.remove('has-error', this.options.errorClass!);

    if (!wrapper) return;

    // Remove error classes from wrapper
    wrapper.classList.remove(this.options.iconErrorClass!);

    // This field's own messages, wherever they were put — including a form-level
    // container, which is where they land on a page with no wrapper classes.
    const key = fieldKey(field);
    if (key) {
      const owned = (field.closest('form') ?? wrapper).querySelectorAll(
        `.${this.options.errorLabelClass}[${ERROR_OWNER_ATTR}="${key}"]`
      );
      owned.forEach(label => label.remove());
    }

    // Messages with no owner stamped on them: written by an older build, or by a
    // page's own markup. Only ever removed from a *real* wrapper — never from the
    // parent-element fallback, which on a wrapperless page is the whole form.
    this.clearUnownedLabelIn(wrapper === field.parentElement ? null : wrapper);
    this.clearUnownedLabelIn(
      field.closest(`.${this.options.wrapperClass}`) as HTMLElement | null
    );
  }

  /** Removes one message that names no field, from a container known to be a wrapper. */
  private clearUnownedLabelIn(container: HTMLElement | null): void {
    const label = container?.querySelector(
      `.${this.options.errorLabelClass}:not([${ERROR_OWNER_ATTR}])`
    );
    label?.remove();
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
    const errorLabels = container.querySelectorAll(`.${this.options.errorLabelClass}`);
    errorLabels.forEach(label => label.remove());

    // Remove error classes from fields
    const errorFields = container.querySelectorAll(`.${this.options.errorClass}, .has-error`);
    errorFields.forEach(field => {
      field.classList.remove('has-error', this.options.errorClass!);
    });

    // Remove error icons from wrappers
    const errorWrappers = container.querySelectorAll(`.${this.options.iconErrorClass}`);
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
  private findField(fieldName: string, container: HTMLElement): HTMLElement | null {
    const selectors = [
      `[data-next-checkout-field="${fieldName}"]`,
      `[os-checkout-field="${fieldName}"]`,
      `[name="${fieldName}"]`,
      `#${fieldName}`
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
    const toastHandler = document.querySelector('[next-checkout-element="spreedly-error"]');
    if (!(toastHandler instanceof HTMLElement)) return;

    const messageElement = toastHandler.querySelector('[data-os-message="error"]');
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
    const toastHandler = document.querySelector('[next-checkout-element="spreedly-error"]');
    if (toastHandler instanceof HTMLElement) {
      toastHandler.style.display = 'none';
    }
  }
}

