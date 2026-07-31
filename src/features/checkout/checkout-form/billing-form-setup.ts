/**
 * Builds the billing address form by cloning the shipping one.
 *
 * A page author writes their address fields **once**, for shipping. When the shopper
 * unticks "billing same as shipping", a second full address form has to exist — so the
 * SDK clones the shipping rows, rewrites every field's identity to its `billing-`
 * equivalent, clears the values, and drops the result into the billing container. That
 * rewrite is what {@link convertShippingFieldsToBilling} does, and it is the reason a page
 * needs no billing markup at all.
 *
 * Extracted from `checkout-form.enhancer.ts` as the third cut out of that file. The whole
 * cluster needs only three things from the form ({@link BillingFormSetupContext}) despite
 * being ~170 lines, because it works on the document rather than on the enhancer's state.
 *
 * The **initial** open/closed state is set here too, deliberately without animation — see
 * {@link setInitialBillingFormState}. Animating between states afterwards is
 * `billing-animation.ts`.
 */

import type { Logger } from '@/core/logger';

import {
  BILLING_CONTAINER_SELECTOR,
  BILLING_FORM_CONTAINER_SELECTOR,
  SHIPPING_FORM_SELECTOR,
} from '../constants/selectors';

/** Marks a cloned row so the shipping scan does not pick it up again. */
const LOCATION_COMPONENT = '[data-next-component="location"]';
const SHIPPING_FIELD_ROW = '[data-next-component="shipping-field-row"]';

/**
 * What this module needs from the checkout form.
 *
 * Three things for ~170 lines of work, because everything else it touches is the DOM.
 * Mirrors the context pattern used by `phone-input.ts` and `billing-animation.ts`.
 */
export interface BillingFormSetupContext {
  /** The `<form>` itself — only used to find the "same as shipping" toggle within it. */
  form: HTMLElement;
  /**
   * Billing fields by name, filled in by {@link scanBillingFields}. The form owns the map
   * because the rest of the checkout reads from it.
   */
  billingFields: Map<string, HTMLElement>;
  logger: Logger;
}

/**
 * Finds every `billing-` prefixed field in the document and records it by name.
 *
 * Both the current `data-next-checkout-field` and the legacy `os-checkout-field` spellings
 * are scanned, because pages built against the older attribute are still live.
 *
 * Queries `document`, not the form: the billing container is often a sibling of the form
 * rather than inside it.
 */
export function scanBillingFields(ctx: BillingFormSetupContext): void {
  const billingSelectors = [
    '[os-checkout-field^="billing-"]',
    '[data-next-checkout-field^="billing-"]',
  ];
  billingSelectors.forEach(selector => {
    document.querySelectorAll(selector).forEach(element => {
      // Spelled out rather than `legacy || current`, because the fallthrough condition
      // is the whole point and `??` would get it wrong: `getAttribute` returns `''`
      // for a present-but-empty attribute, so an element carrying
      // `os-checkout-field=""` alongside a real `data-next-checkout-field` has to fall
      // through to the second. `??` only falls through on `null` and would read the
      // empty string, dropping that field from the map.
      const legacyName = element.getAttribute('os-checkout-field');
      const fieldName =
        legacyName !== null && legacyName !== ''
          ? legacyName
          : element.getAttribute('data-next-checkout-field');
      if (fieldName && element instanceof HTMLElement) {
        ctx.billingFields.set(fieldName, element);
      }
    });
  });
}

/**
 * Rewrites a cloned shipping row into a billing one, in place.
 *
 * Four separate identities have to change, and missing any one of them produces a form
 * that looks right and misbehaves:
 *
 * - `data-next-checkout-field` and the legacy `os-checkout-field` — how the SDK finds the
 *   field at all.
 * - `name` and `id` — how the browser groups inputs and how `<label for>` resolves. Left
 *   alone, a cloned radio would share a group with its shipping original and unticking one
 *   would untick the other.
 *
 * Values are cleared because a clone otherwise arrives pre-filled with the shipping
 * address, which is exactly the address the shopper has just said is *not* the billing one.
 * Headings are removed because the shipping section's "Shipping address" title would
 * otherwise be duplicated above the billing fields.
 *
 * Prefixing is idempotent — anything already `billing-`/`billing_` is left as is, so
 * running over an already-converted subtree is safe.
 */
export function convertShippingFieldsToBilling(billingForm: HTMLElement): void {
  billingForm.querySelectorAll('h1, h2, h3, h4, h5, h6').forEach(heading => {
    heading.remove();
  });

  billingForm.querySelectorAll('[data-next-checkout-field]').forEach(field => {
    const currentValue = field.getAttribute('data-next-checkout-field');
    if (currentValue && !currentValue.startsWith('billing-')) {
      field.setAttribute('data-next-checkout-field', `billing-${currentValue}`);
    }
  });

  billingForm.querySelectorAll('[os-checkout-field]').forEach(field => {
    const currentValue = field.getAttribute('os-checkout-field');
    if (currentValue && !currentValue.startsWith('billing-')) {
      field.setAttribute('os-checkout-field', `billing-${currentValue}`);
    }
  });

  billingForm.querySelectorAll('input, select, textarea').forEach(field => {
    const element = field as
      | HTMLInputElement
      | HTMLSelectElement
      | HTMLTextAreaElement;

    if (element.name && !element.name.startsWith('billing_')) {
      element.name = element.name.startsWith('shipping_')
        ? element.name.replace('shipping_', 'billing_')
        : `billing_${element.name}`;
    }

    if (element.id && !element.id.startsWith('billing_')) {
      element.id = element.id.startsWith('shipping_')
        ? element.id.replace('shipping_', 'billing_')
        : `billing_${element.id}`;
    }

    if (element.type === 'checkbox' || element.type === 'radio') {
      (element as HTMLInputElement).checked = false;
    } else {
      element.value = '';
    }
  });
}

/**
 * Applies the billing section's opening state, **without animating**.
 *
 * On first paint the section has to already be right — animating from a wrong state is
 * visible as a flash of the billing form on a page where billing matches shipping. So this
 * writes the same end states `billing-animation.ts` settles on, and skips the transition
 * entirely by clearing any inline `transition` first.
 *
 * The toggle's meaning is worth stating because it inverts: **checked means "same as
 * shipping"**, so checked collapses the form and unchecked expands it.
 */
export function setInitialBillingFormState(ctx: BillingFormSetupContext): void {
  const billingToggle = ctx.form.querySelector(
    'input[name="use_shipping_address"]'
  ) as HTMLInputElement;
  const billingSection = document.querySelector(
    BILLING_CONTAINER_SELECTOR
  ) as HTMLElement;

  ctx.logger.info('[Billing] Setting initial state', {
    toggleFound: !!billingToggle,
    sectionFound: !!billingSection,
    toggleChecked: billingToggle?.checked,
    currentHeight: billingSection?.style.height,
    currentOverflow: billingSection?.style.overflow,
    currentClasses: billingSection?.className,
  });

  if (billingToggle && billingSection) {
    // Cleared first so no leftover transition animates this initial write.
    billingSection.style.removeProperty('height');
    billingSection.style.removeProperty('overflow');
    billingSection.style.removeProperty('transition');

    if (billingToggle.checked) {
      billingSection.style.height = '0px';
      billingSection.style.overflow = 'hidden';
      billingSection.classList.add('billing-form-collapsed');
      billingSection.classList.remove('billing-form-expanded');
      ctx.logger.info('[Billing] Initial state: COLLAPSED (checkbox checked)');
    } else {
      billingSection.style.height = 'auto';
      billingSection.style.overflow = 'visible';
      billingSection.classList.add('billing-form-expanded');
      billingSection.classList.remove('billing-form-collapsed');
      ctx.logger.info('[Billing] Initial state: EXPANDED (checkbox unchecked)');
    }
  } else {
    ctx.logger.warn('[Billing] Could not set initial state - missing elements');
  }
}

/**
 * Clones the shipping form into the billing container and sets its opening state.
 *
 * @returns `false` when the page has no billing container, no shipping form, or no inner
 *   form container to fill — meaning this page simply does not offer a separate billing
 *   address. That is a normal configuration, not an error, which is why nothing is logged.
 *
 * Rows are cloned in two passes because the *location* fields (state, city, postcode) are
 * handled differently from the basic ones: they live inside a `location` container that is
 * cloned whole and starts hidden, since they are only revealed once an address line is
 * filled in. The `else` branch covers pages whose location fields have no container — the
 * rows are cloned individually there instead of being dropped.
 */
export function setupBillingForm(ctx: BillingFormSetupContext): boolean {
  const billingContainer = document.querySelector(BILLING_CONTAINER_SELECTOR);
  if (!billingContainer) return false;

  const shippingForm = document.querySelector(SHIPPING_FORM_SELECTOR);
  if (!shippingForm) return false;

  const billingFormContainer = billingContainer.querySelector(
    BILLING_FORM_CONTAINER_SELECTOR
  );
  if (!billingFormContainer) return false;

  billingFormContainer.innerHTML = '';

  const allShippingFieldRows =
    shippingForm.querySelectorAll(SHIPPING_FIELD_ROW);

  // Pass 1: the basic rows (name, country, address1) — everything not in a location box.
  allShippingFieldRows.forEach(row => {
    const isInsideLocation = row.closest(LOCATION_COMPONENT);

    if (!isInsideLocation) {
      const clonedRow = row.cloneNode(true) as HTMLElement;
      convertShippingFieldsToBilling(clonedRow);
      billingFormContainer.appendChild(clonedRow);
    }
  });

  // Pass 2: the location fields, cloned as a whole box so they can be hidden together.
  const locationContainer = shippingForm.querySelector(LOCATION_COMPONENT);

  if (locationContainer) {
    const clonedLocation = locationContainer.cloneNode(true) as HTMLElement;

    clonedLocation.setAttribute('data-next-component', 'billing-location');
    convertShippingFieldsToBilling(clonedLocation);

    // Hidden until a billing address line is entered.
    clonedLocation.classList.add('next-hidden', 'next-location-hidden');
    clonedLocation.style.display = 'none';

    billingFormContainer.appendChild(clonedLocation);
  } else {
    // No location box on this page: clone those rows individually so they are not lost.
    allShippingFieldRows.forEach(row => {
      const isInsideLocation = row.closest(LOCATION_COMPONENT);

      if (isInsideLocation) {
        const clonedRow = row.cloneNode(true) as HTMLElement;
        convertShippingFieldsToBilling(clonedRow);
        billingFormContainer.appendChild(clonedRow);
      }
    });
  }

  setInitialBillingFormState(ctx);
  return true;
}
