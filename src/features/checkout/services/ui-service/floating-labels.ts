/**
 * Shopify-style floating labels for the checkout fields.
 *
 * A field's label starts sitting inside the input. The moment the field has a value —
 * typed, autofilled, selected, or written by the SDK — the label floats up above the text
 * and stays there, so the shopper can still see what the box is for while they read what
 * they entered. Fields marked `data-label-behavior="placeholder"` float on **focus** as
 * well, which is what makes an empty box show its placeholder until it is clicked.
 *
 * The mechanism is a `Map` from field element to its label, built once at setup. Every
 * path — an event, the Spreedly bridge, a programmatic fill, the 500 ms poll — ends in
 * {@link updateLabelState} for one entry of that map, so there is one place that decides
 * up or down.
 *
 * **Why a poll exists.** Browser autofill of a whole address block fires no `input` event
 * on most browsers, so without the interval the labels would sit on top of filled values.
 * Chrome's `animationstart` hook covers Chrome only.
 *
 * **The hosted card fields are different.** The card number and CVV live in a Spreedly
 * iframe, so this module can never read their value or hear their events. The checkout
 * form forwards Spreedly's own focus/blur/input callbacks into
 * {@link handleSpreedlyFieldFocus} and friends, which is why those three take a
 * `hasValue` the others derive themselves.
 *
 * Extracted verbatim from `ui-service.ts`, the largest of its four clusters. It needs five
 * things from the service ({@link FloatingLabelContext}) and calls none of its methods.
 */

import type { Logger } from '@/core/logger';

import type { EventHandlerManager } from '../../utils/event-handler-utils';

/** What this module needs from `UIService`. */
export interface FloatingLabelContext {
  /** The checkout form. Every field lookup is scoped to it. */
  form: HTMLFormElement;
  /**
   * Field element → the label that floats for it.
   *
   * Owned by the service rather than this module because `destroy()` clears it and the
   * service is what has a lifecycle. Keys are `HTMLElement`, not the input union, because
   * the two Spreedly containers are plain `<div>`s.
   */
  labels: Map<HTMLElement, HTMLLabelElement>;
  /** Records every listener so the service can drop them all in one call. */
  events: EventHandlerManager;
  /**
   * The autofill poll's interval id.
   *
   * A ref, not a number, because {@link startPeriodicCheck} writes it and the service's
   * `destroy()` reads it — a copied primitive would leave each side with its own. Same
   * shape as `inProgress` in `checkout-form/billing-animation.ts`.
   */
  periodicCheck: { value: number | undefined };
  logger: Logger;
}

/**
 * Wires floating labels for every field in the form, then starts the autofill poll.
 *
 * Runs once, from `UIService.initialize()`.
 */
export function initializeFloatingLabels(ctx: FloatingLabelContext): void {
  ctx.logger.debug('Initializing floating labels');

  // Find all form groups with labels
  const formGroups = ctx.form.querySelectorAll('.form-group');

  formGroups.forEach(formGroup => {
    const label = formGroup.querySelector('.label-checkout');
    const input = formGroup.querySelector(
      'input[data-next-checkout-field], input[os-checkout-field], select[data-next-checkout-field], select[os-checkout-field]'
    );

    if (
      label instanceof HTMLLabelElement &&
      (input instanceof HTMLInputElement || input instanceof HTMLSelectElement)
    ) {
      setupFloatingLabel(ctx, input, label);
    }
  });

  // Also setup Spreedly fields (credit card and CVV)
  setupSpreedlyFloatingLabels(ctx);

  ctx.logger.debug(`Initialized ${ctx.labels.size} floating labels`);

  // Start periodic check for autocomplete detection
  startPeriodicCheck(ctx);
}

/**
 * Registers the two hosted card containers, which have no input element to listen to.
 *
 * They are registered anyway so {@link handleSpreedlyFieldFocus} and friends can find
 * their label; the state changes arrive from Spreedly rather than from the DOM.
 */
function setupSpreedlyFloatingLabels(ctx: FloatingLabelContext): void {
  // Setup credit card number field
  const ccNumberContainer = ctx.form.querySelector(
    '[data-next-checkout-field="cc-number"], #spreedly-number'
  ) as HTMLElement;
  if (ccNumberContainer) {
    const label =
      ccNumberContainer.parentElement?.querySelector('.label-checkout');
    if (label instanceof HTMLLabelElement) {
      ctx.labels.set(ccNumberContainer, label);
      setupLabelStyles(label);

      // Check if it has placeholder behavior
      const behavior = ccNumberContainer.getAttribute('data-label-behavior');
      if (behavior === 'placeholder') {
        // Initially float down (will be handled by Spreedly events)
        floatLabelDown(ctx, label, ccNumberContainer as HTMLInputElement);
      }

      ctx.logger.debug('Set up Spreedly floating label for credit card number');
    }
  }

  // Setup CVV field
  const cvvContainer = ctx.form.querySelector(
    '[data-next-checkout-field="cvv"], #spreedly-cvv'
  ) as HTMLElement;
  if (cvvContainer) {
    const label = cvvContainer.parentElement?.querySelector('.label-checkout');
    if (label instanceof HTMLLabelElement) {
      ctx.labels.set(cvvContainer, label);
      setupLabelStyles(label);

      // Check if it has placeholder behavior
      const behavior = cvvContainer.getAttribute('data-label-behavior');
      if (behavior === 'placeholder') {
        // Initially float down (will be handled by Spreedly events)
        floatLabelDown(ctx, label, cvvContainer as HTMLInputElement);
      }

      ctx.logger.debug('Set up Spreedly floating label for CVV');
    }
  }
}

/**
 * The shopper focused a hosted card field.
 *
 * Only `placeholder` behaviour reacts: the default behaviour floats on value alone, and
 * this module cannot read a hosted field's value.
 */
export function handleSpreedlyFieldFocus(
  ctx: FloatingLabelContext,
  fieldName: 'number' | 'cvv'
): void {
  const fieldId = fieldName === 'number' ? 'spreedly-number' : 'spreedly-cvv';
  const field =
    document.getElementById(fieldId) ||
    (ctx.form.querySelector(
      `[data-next-checkout-field="${fieldName === 'number' ? 'cc-number' : 'cvv'}"]`
    ) as HTMLElement);

  if (!field) {
    ctx.logger.warn(`Spreedly field not found: ${fieldName}`);
    return;
  }

  const label = ctx.labels.get(field);
  if (label) {
    const behavior = field.getAttribute('data-label-behavior');

    if (behavior === 'placeholder') {
      // Placeholder behavior: always float up on focus
      floatLabelUp(ctx, label, field as HTMLInputElement, 'focus');
    }

    ctx.logger.debug(`Spreedly field focused: ${fieldName}`);
  }
}

/**
 * The shopper left a hosted card field.
 *
 * @param hasValue Spreedly's own report of whether the field holds anything — the one
 * fact this module cannot read for itself.
 */
export function handleSpreedlyFieldBlur(
  ctx: FloatingLabelContext,
  fieldName: 'number' | 'cvv',
  hasValue: boolean
): void {
  const fieldId = fieldName === 'number' ? 'spreedly-number' : 'spreedly-cvv';
  const field =
    document.getElementById(fieldId) ||
    (ctx.form.querySelector(
      `[data-next-checkout-field="${fieldName === 'number' ? 'cc-number' : 'cvv'}"]`
    ) as HTMLElement);

  if (!field) {
    ctx.logger.warn(`Spreedly field not found: ${fieldName}`);
    return;
  }

  const label = ctx.labels.get(field);
  if (label) {
    const behavior = field.getAttribute('data-label-behavior');

    if (behavior === 'placeholder') {
      // Placeholder behavior: only keep floating if field has value
      if (!hasValue) {
        floatLabelDown(ctx, label, field as HTMLInputElement);
      }
    } else {
      // Default behavior
      if (hasValue) {
        floatLabelUp(ctx, label, field as HTMLInputElement);
      } else {
        floatLabelDown(ctx, label, field as HTMLInputElement);
      }
    }

    ctx.logger.debug(
      `Spreedly field blurred: ${fieldName}, hasValue: ${hasValue}`
    );
  }
}

/**
 * A hosted card field's contents changed.
 *
 * Reads focus from the container's classes rather than `document.activeElement`, which
 * points at the iframe rather than at the field inside it.
 */
export function handleSpreedlyFieldInput(
  ctx: FloatingLabelContext,
  fieldName: 'number' | 'cvv',
  hasValue: boolean
): void {
  const fieldId = fieldName === 'number' ? 'spreedly-number' : 'spreedly-cvv';
  const field =
    document.getElementById(fieldId) ||
    (ctx.form.querySelector(
      `[data-next-checkout-field="${fieldName === 'number' ? 'cc-number' : 'cvv'}"]`
    ) as HTMLElement);

  if (!field) {
    ctx.logger.warn(`Spreedly field not found: ${fieldName}`);
    return;
  }

  const label = ctx.labels.get(field);
  if (label) {
    const behavior = field.getAttribute('data-label-behavior');
    const isFocused =
      field.classList.contains('next-focused') ||
      field.classList.contains('has-focus');

    if (behavior === 'placeholder') {
      // For placeholder behavior, keep floating if focused or has value
      if (isFocused || hasValue) {
        floatLabelUp(
          ctx,
          label,
          field as HTMLInputElement,
          isFocused ? 'focus' : 'value'
        );
      } else {
        floatLabelDown(ctx, label, field as HTMLInputElement);
      }
    } else {
      // Default behavior
      if (hasValue) {
        floatLabelUp(ctx, label, field as HTMLInputElement);
      } else {
        floatLabelDown(ctx, label, field as HTMLInputElement);
      }
    }

    ctx.logger.debug(
      `Spreedly field input: ${fieldName}, hasValue: ${hasValue}`
    );
  }
}

/**
 * Binds one field to its label and starts tracking it.
 *
 * Five listeners, because a value can arrive five ways: typing (`input`), tabbing in and
 * out (`focus`/`blur`), a `<select>` or password-manager fill (`change`), and Chrome's
 * autofill animation (`animationstart`).
 *
 * @param label The label to float. Looked up from the field's `.form-group` when omitted.
 */
export function setupFloatingLabel(
  ctx: FloatingLabelContext,
  field: HTMLInputElement | HTMLSelectElement,
  label?: HTMLLabelElement
): void {
  // If no label provided, try to find it
  if (!label) {
    const formGroup = field.closest('.form-group');
    if (formGroup) {
      const labelElement = formGroup.querySelector('.label-checkout');
      if (labelElement instanceof HTMLLabelElement) {
        label = labelElement;
      }
    }
  }

  if (!label) {
    ctx.logger.warn('No label found for floating label setup');
    return;
  }

  // Store the relationship
  ctx.labels.set(field, label);

  // Set initial positioning styles on the label
  setupLabelStyles(label);

  // Set initial field styles
  setupFieldStyles(field);

  // Check initial state (in case field already has value)
  updateLabelState(ctx, field, label);

  // Add event listeners using EventHandlerManager
  ctx.events.addHandler(field, 'input', (e: Event) => handleInput(ctx, e));
  ctx.events.addHandler(field, 'focus', (e: Event) => handleFocus(ctx, e));
  ctx.events.addHandler(field, 'blur', (e: Event) => handleBlur(ctx, e));
  ctx.events.addHandler(field, 'change', (e: Event) => handleInput(ctx, e)); // Handle autocomplete
  ctx.events.addHandler(field, 'animationstart', (e: Event) =>
    handleAutofill(ctx, e)
  ); // Chrome autofill detection

  ctx.logger.debug(
    'Set up floating label for field:',
    field.getAttribute('data-next-checkout-field') || field.name
  );
}

/** Gives the label a transition so the float animates rather than jumping. */
function setupLabelStyles(label: HTMLLabelElement): void {
  // Ensure the label has the transition for smooth animation
  if (!label.style.transition) {
    label.style.transition = 'all 0.15s ease-in-out';
  }
}

/** Makes the field's wrapper a positioning context, so the label can sit over it. */
function setupFieldStyles(field: HTMLInputElement | HTMLSelectElement): void {
  // Ensure relative positioning for absolute label
  const formInput = field.closest('.form-input');
  if (formInput instanceof HTMLElement) {
    formInput.style.position = 'relative';
  }
}

/** The shopper is typing, or a value arrived without typing. */
function handleInput(ctx: FloatingLabelContext, event: Event): void {
  const field = event.target as HTMLInputElement | HTMLSelectElement;
  const label = ctx.labels.get(field);

  if (label) {
    updateLabelState(ctx, field, label);
  }
}

/** The field gained focus. Only `placeholder` behaviour floats on focus alone. */
function handleFocus(ctx: FloatingLabelContext, event: Event): void {
  const field = event.target as HTMLInputElement | HTMLSelectElement;
  const label = ctx.labels.get(field);

  if (label) {
    const behavior = field.getAttribute('data-label-behavior');

    if (behavior === 'placeholder') {
      // Placeholder behavior: always float up on focus
      floatLabelUp(ctx, label, field as HTMLInputElement, 'focus');
    } else {
      // Default Shopify behavior: only float up if field has value
      if (hasValue(field)) {
        floatLabelUp(ctx, label, field);
      }
    }
  }
}

/** The field lost focus. A `placeholder` field drops its label again unless it was filled. */
function handleBlur(ctx: FloatingLabelContext, event: Event): void {
  const field = event.target as HTMLInputElement | HTMLSelectElement;
  const label = ctx.labels.get(field);

  if (label) {
    const behavior = field.getAttribute('data-label-behavior');

    if (behavior === 'placeholder') {
      // Placeholder behavior: only keep floating if field has value
      if (!hasValue(field)) {
        floatLabelDown(ctx, label, field);
      }
    } else {
      // Default behavior
      updateLabelState(ctx, field, label);
    }
  }
}

/**
 * Chrome's autofill hook.
 *
 * Chrome runs a CSS animation named `autofill` on a field it fills, which is the only
 * event it emits for it. The delay is there because the animation starts before the value
 * is readable.
 */
function handleAutofill(ctx: FloatingLabelContext, event: Event): void {
  const animationEvent = event as AnimationEvent;
  if (animationEvent.animationName === 'autofill') {
    const field = event.target as HTMLInputElement | HTMLSelectElement;
    const label = ctx.labels.get(field);

    if (label) {
      // Delay slightly to ensure autofill is complete
      setTimeout(() => {
        updateLabelState(ctx, field, label);
      }, 100);
    }
  }
}

/** The one place that decides whether a label belongs up or down. */
function updateLabelState(
  ctx: FloatingLabelContext,
  field: HTMLInputElement | HTMLSelectElement,
  label: HTMLLabelElement
): void {
  const behavior = field.getAttribute('data-label-behavior');

  // For placeholder behavior, check if field is currently focused
  if (behavior === 'placeholder') {
    const isFocused = document.activeElement === field;

    if (isFocused || hasValue(field)) {
      floatLabelUp(ctx, label, field, isFocused ? 'focus' : 'value');
    } else {
      floatLabelDown(ctx, label, field);
    }
  } else {
    // Default behavior
    if (hasValue(field)) {
      floatLabelUp(ctx, label, field);
    } else {
      floatLabelDown(ctx, label, field);
    }
  }
}

/**
 * Whether the field holds something worth floating the label for.
 *
 * A `<select>` counts as empty while it still shows its first option, which is how a
 * "Choose a country" prompt is told apart from a chosen country.
 */
function hasValue(field: HTMLInputElement | HTMLSelectElement): boolean {
  if (field instanceof HTMLSelectElement) {
    return (
      field.value !== '' && field.value !== field.querySelector('option')?.value
    );
  }
  return field.value.trim() !== '';
}

/**
 * Floats the label above the input and makes room for it.
 *
 * @param reason `focus` also marks the label `is-focused`, which is what lets CSS style a
 * label floating because the box is active differently from one floating because it is
 * filled.
 */
function floatLabelUp(
  ctx: FloatingLabelContext,
  label: HTMLLabelElement,
  field: HTMLInputElement | HTMLSelectElement,
  reason: 'value' | 'focus' = 'value'
): void {
  if (label.classList.contains('has-value')) {
    // If already floating but now focused, add is-focused class
    if (reason === 'focus' && !label.classList.contains('is-focused')) {
      label.classList.add('is-focused');
    }
    return;
  }

  // Add has-value class for CSS animation
  label.classList.add('has-value');

  // Track if this is due to focus (for placeholder behavior)
  if (reason === 'focus') {
    label.classList.add('is-focused');
  }

  // Add padding-top to input field
  field.style.paddingTop = '14px';

  // Hide placeholder when label is floating (for placeholder behavior)
  const behavior = field.getAttribute('data-label-behavior');
  if (behavior === 'placeholder' && field instanceof HTMLInputElement) {
    field.setAttribute('data-original-placeholder', field.placeholder || '');
    field.placeholder = '';
  }

  ctx.logger.debug(
    `Added has-value class for field (${reason}):`,
    field.getAttribute('data-next-checkout-field') || field.name
  );
}

/** Drops the label back inside the input and restores the placeholder it hid. */
function floatLabelDown(
  ctx: FloatingLabelContext,
  label: HTMLLabelElement,
  field: HTMLInputElement | HTMLSelectElement
): void {
  if (!label.classList.contains('has-value')) return;

  // Remove has-value and is-focused classes for CSS animation
  label.classList.remove('has-value', 'is-focused');

  // Reset padding-top on input field
  field.style.paddingTop = '';

  // Restore placeholder when label floats down (for placeholder behavior)
  const behavior = field.getAttribute('data-label-behavior');
  if (behavior === 'placeholder' && field instanceof HTMLInputElement) {
    const originalPlaceholder = field.getAttribute('data-original-placeholder');
    if (originalPlaceholder !== null) {
      field.placeholder = originalPlaceholder;
    }
  }

  ctx.logger.debug(
    'Removed has-value class for field:',
    field.getAttribute('data-next-checkout-field') || field.name
  );
}

/**
 * Starts the fallback poll that catches values no event announced.
 *
 * `UIService.destroy()` clears it. Nothing else does — see the caution in the module
 * header of `ui-service.ts` about who is responsible for calling that.
 */
function startPeriodicCheck(ctx: FloatingLabelContext): void {
  // Check every 500ms for autocomplete changes
  ctx.periodicCheck.value = window.setInterval(() => {
    checkAllFieldsForChanges(ctx);
  }, 500);
}

/** Re-decides every tracked label, for values that arrived without an event. */
function checkAllFieldsForChanges(ctx: FloatingLabelContext): void {
  ctx.labels.forEach((label, field) => {
    if (
      field instanceof HTMLInputElement ||
      field instanceof HTMLSelectElement
    ) {
      updateLabelState(ctx, field, label);
    }
  });
}

/**
 * Re-decides every label after the SDK wrote values into the form itself.
 *
 * Called when stored checkout data is replayed into the fields: those writes fire no
 * events, so without this the labels would sit on top of the restored values.
 */
export function updateLabelsForPopulatedData(ctx: FloatingLabelContext): void {
  ctx.labels.forEach((label, field) => {
    if (
      field instanceof HTMLInputElement ||
      field instanceof HTMLSelectElement
    ) {
      updateLabelState(ctx, field, label);
    }
  });

  ctx.logger.debug('Updated all floating labels for populated data');
}

/**
 * Tags the form with its viewport class and, on phones, floats every label on focus.
 *
 * Lives here rather than in `ui-service.ts` because everything it does past the three
 * class toggles is label behaviour — it reads the same map and calls the same float.
 *
 * **Caution — the mobile branch leaks listeners.** Those `focus` handlers are attached
 * straight to the element instead of through {@link FloatingLabelContext.events}, so
 * `UIService.destroy()` cannot remove them, and calling this twice attaches a second set.
 * Left as found: routing them through the manager would *replace* the `focus` handler
 * {@link setupFloatingLabel} already registered for the same element, which is a
 * behaviour change and belongs in its own commit.
 */
export function handleResponsiveUI(ctx: FloatingLabelContext): void {
  const isMobile = window.innerWidth <= 768;
  const isTablet = window.innerWidth <= 1024 && window.innerWidth > 768;

  // Add responsive classes to form
  ctx.form.classList.toggle('next-mobile', isMobile);
  ctx.form.classList.toggle('next-tablet', isTablet);
  ctx.form.classList.toggle('next-desktop', !isMobile && !isTablet);

  // Adjust floating label behavior for mobile
  if (isMobile) {
    // On mobile, always float labels up when focused for better UX
    ctx.labels.forEach((label, field) => {
      const focusHandler = () => {
        floatLabelUp(ctx, label, field as HTMLInputElement | HTMLSelectElement);
      };
      field.addEventListener('focus', focusHandler);
    });
  }

  ctx.logger.debug(
    `Handled responsive UI adjustments for ${isMobile ? 'mobile' : isTablet ? 'tablet' : 'desktop'}`
  );
}
