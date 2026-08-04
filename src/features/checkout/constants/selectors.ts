/**
 * DOM selector constants for checkout form elements.
 *
 * Only the selectors below still have a caller. Seven more once lived here —
 * `FIELD_SELECTORS`, `PAYMENT_BUTTON_SELECTORS`, `BILLING_FIELD_SELECTORS`,
 * `EXPIRATION_MONTH_SELECTORS`, `EXPIRATION_YEAR_SELECTORS`,
 * `PAYMENT_METHOD_SELECTOR` and `SHIPPING_METHOD_SELECTOR` — with no importer;
 * `checkout-form/field-scanning.ts` declares its own local `FIELD_SELECTORS`
 * instead. They were removed rather than left as a second source of truth; this
 * file's history has them if a shared copy is wanted back.
 *
 * `META_TAG_SELECTORS` is the exception: nothing imports it either, but the meta
 * tags it lists are extracted from this file's text into the generated
 * `core/guide/reference/meta-tags.md`, so deleting it would silently drop rows
 * from a published page. See the report on finding 182.
 *
 * **Every element selector below must list both attribute spellings.** A page may
 * mark its checkout up with the legacy `os-checkout-*` attributes or the current
 * `data-next-component`, and pages in the wild mix the two within one document.
 * Dropping either half does not fail loudly — the query just returns `null` and the
 * feature silently does nothing. That is exactly what happened when
 * `billing-form-setup.ts` was extracted against a legacy-only
 * `SHIPPING_FORM_SELECTOR`: `setupBillingForm` returned `false` on every page using
 * `data-next-component="shipping-form"`, so the billing section opened as an empty
 * box with no cloned fields, and no test caught it because every fixture is written
 * in the legacy spelling.
 */

export const BILLING_CONTAINER_SELECTOR =
  '[os-checkout-element="different-billing-address"], [data-next-component="different-billing-address"]';
export const SHIPPING_FORM_SELECTOR =
  '[os-checkout-component="shipping-form"], [data-next-component="shipping-form"]';
export const BILLING_FORM_CONTAINER_SELECTOR =
  '[os-checkout-component="billing-form"], [data-next-component="billing-form"]';

export const BILLING_TOGGLE_SELECTOR = 'input[name="use_shipping_address"]';

export const META_TAG_SELECTORS = {
  SUCCESS_URL: ['meta[name="next-success-url"]', 'meta[name="next-next-url"]', 'meta[name="os-next-page"]'],
  FAILURE_URL: ['meta[name="next-failure-url"]', 'meta[name="os-failure-url"]'],
  NEXT_PAGE: ['meta[name="next-success-url"]', 'meta[name="next-next-url"]', 'meta[name="os-next-page"]']
} as const;