---
title: 'Start Here/Migrating from 0.4.x'
group: 'Start Here'
category: 'Start Here'
order: 2
---

# Migrating from 0.4.x

**A 0.4.x page keeps working.** Old attributes, `nextConfig` keys, `window.next` methods and event
names are still read.

What to check, in order:

1. [Removed](#removed): fix these if your page uses them.
2. [Works differently](#works-differently): no change needed, but behavior moved.
3. [Deprecated](#deprecated): still works; use the new name on new pages.
4. [Unchanged](#unchanged): nothing to do.

Every 0.4.43 attribute, method, event and config key is listed in
[parity-0.4.md](../architecture/parity-0.4.md).

## Removed

| 0.4.x                                                                                                                 | What to do                                                                                                                                                |
| --------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `data-prospect-config`, `data-min-phone-digits`, `data-email-field`, `data-phone-field` (logs a warning)              | Set [`data-next-lead`](attribute-reference/checkout/data-next-lead.md); mark inputs with `data-next-checkout-field`. The address service checks the phone |
| `data-next-action="accept-upsell"`, `data-next-upsell-option`, `data-next-upsell-select`, `data-next-upsell-quantity` | Put a bundle selector with `data-next-upsell-context` inside the offer                                                                                    |
| `next.addUpsell`, `canAddUpsells`, `getCompletedUpsells`, `isUpsellAlreadyAdded`                                      | Use the offer attributes (`data-next-upsell`, `data-next-upsell-action`)                                                                                  |
| Duplicate-upsell modal ("Already Added!")                                                                             | Nothing: an offer already accepted on that page moves on without charging again                                                                           |
| `nextConfig.googleMaps` (Google address autocomplete)                                                                 | Nothing: no campaign had an API key set                                                                                                                   |
| `data-next-i18n`                                                                                                      | Nothing: pages keep their own words                                                                                                                       |
| Events `cart:package-swapped`, `order:redirect-missing`, `address:messages-loaded` (`next.on` warns)                  | Remove the listener                                                                                                                                       |
| Event `upsell:accepted`                                                                                               | Listen for `upsell:added`                                                                                                                                 |
| `dl_package_swapped`                                                                                                  | A bundle change now sends `dl_remove_from_cart` + `dl_add_to_cart`                                                                                        |
| `token` and `pmData` on `payment:tokenized`                                                                           | The event still fires without them; a warning says so once a page                                                                                         |

## Works differently

### Checkout

- **Express buttons** place the order without checking the form.
  - To check first: `nextConfig.paymentConfig.expressCheckout.requireValidation` (with
    `requiredFields`).
  - PayPal or Klarna chosen _in the form_ gets the form's full checks and sends the shopper's
    details.
- **Coupon on an empty cart** is checked once the cart is first priced. `next.applyCoupon` still
  answers `true` at once.
- **Phone placeholder**: the page's own is kept (0.4.43 replaced it with `Phone*`).
- **`data-next-address`**: `-lang` and `-api` are not read.
- **`addressConfig.countries` / `dontShowStates`**: only the campaign's shipping countries that
  are also in the list are offered.
- **`expressCheckout.methodOrder`**: only the campaign's express methods in the list show, in
  its order.
- **`data-next-include-shipping`** is ignored. 0.4.x never sent it to the API either.

### Events

- `checkout:started` still comes on every checkout page; the new `checkout.started` comes once per
  checkout.
- `next.exitIntent()` also takes `id` and `name`, which reach `promotion_viewed` and
  `promotion_selected`.

### dataLayer

- `dl_begin_checkout`, `dl_add_shipping_info`, `dl_add_payment_info`: once per checkout. A later
  step, a reload or a return from the payment gateway does not send them again.
- `dl_add_to_cart` is now sent for a cart filled before the page loaded (default bundle,
  `forcePackageId`, `forceBundleId`, a redirecting add-to-cart button), at the cart price.
  Filter on `first_in_session` to send one AddToCart per tab.
- `dl_upsell_purchase` is sent on the next page from the order's own lines; nothing is queued in
  sessionStorage.
- `dl_purchase`:
  - `user_properties` without the customer's email, name and address.
  - No URL query strings in `page_referrer` / `attribution.metadata`.
  - Same `transaction_id`, value, tax basis (picked per order, as 0.4.x did), `item_sku`, per-item
    `discount`, `item_brand` and `coupon`.

### Widgets

- `data-next-tooltip`: same look, placed above (or below when there is no room) without
  floating-ui. `-placement` is ignored.

## Deprecated

Still works. Use the right column on new pages.

| 0.4.x                                                                                              | Use instead                                                                                                                                                                                                                                                               |
| -------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `data-next-checkout-field="fname"`, `address1`, `postal`, …                                        | `first_name`, `last_name`, `line1`, `line2`, `city`, `state`, `postcode`, `phone_number`                                                                                                                                                                                  |
| `os-checkout-field`, `os-checkout-element`, `os-checkout-step`                                     | `data-next-checkout-field`, `data-next-component`, `data-next-checkout-step`                                                                                                                                                                                              |
| `data-trigger-on`, `data-auto-create="false"` on the form                                          | [`data-next-lead`](attribute-reference/checkout/data-next-lead.md): `email`, `phone`, `email+phone`, `off`                                                                                                                                                                |
| `next:prospect-cart-created` on the form                                                           | `next.on('user.created')`                                                                                                                                                                                                                                                 |
| `next.getShippingMethods / setShippingMethod / getSelectedShippingMethod`                          | Read `next.snapshot().cart.shipping_method`; set with `next.actions.setShipping(id)`                                                                                                                                                                                      |
| `data-next-bundle-selector-id` on the offer                                                        | Put the `[data-next-bundle-selector]` inside `[data-next-upsell]`                                                                                                                                                                                                         |
| `next.on('cart:updated')` and the other 0.4.x event names                                          | The [Event Reference](events.md) names. The old ones still fire with their 0.4.43 payloads                                                                                                                                                                                |
| `dl_*` in `window.dataLayer` / `NextDataLayer`, `NextDataLayerTransformFn`                         | `next.analytics.on(name, fn)` with the [tracking names](/analytics): `dl_add_to_cart` → `product_added_to_cart`, `dl_purchase` → `checkout_completed`, `dl_user_data` → `page_viewed`, …                                                                                  |
| `nextConfig.analytics.providers.gtm.enabled`, `providers.facebook.enabled`, `nextConfig.storeName` | `nextConfig.analytics.destinations.gtm.enabled`, `destinations.meta.enabled` and `destinations.meta.storeName` ([Destinations](analytics-reference/destinations/overview.md#config)). The Meta pixel is built in again, and the 0.4.x keys still turn GTM off and Meta on |
| `data-next-timer`, `data-next-accordion`, `data-next-tooltip`, `data-next-component="scroll-hint"` | Your own script or CSS: `<details>` for an accordion, `title` or CSS for a tooltip                                                                                                                                                                                        |

The page widgets (timer, accordion, tooltip, scroll hint) load in a small chunk only on pages that
use them, and keep their 0.4.x attributes and events (`timer:expired`, `accordion:*`,
`scroll-hint:updated`).

## Unchanged

- **Address form** (`data-next-address="shipping|billing"`): the country's fields and order,
  rebuilt on a country change.
- **Phone field**: flag (`img.next-phone-flag`), typing mask, E.164 in `data-next-phone-e164`.
- **US territories** (AS, GU, MP, PR, VI, UM): never offered in the state list.
- **NextCommerce autocomplete** (`addressConfig.enableAutocomplete`): same dropdown and `pac-*`
  classes.
- **Coupons**: a code that takes nothing off is not kept, and `coupon:validation-failed` fires.
- **Step guard**: `sessionStorage['next-checkout-store']` is written in the old shape on
  multi-step pages.
- **Upsells**: `data-next-upsell="offer"`, `data-next-upsell-action="add|skip"`
  (`accept`/`decline`), the `next-upsell-accept-url` / `-decline-url` metas, and the classes
  `next-available`, `next-hidden`, `next-processing`, `next-success`, `next-error`,
  `next-skipped`.
- **Receipt**: `order.*` display paths and `[data-next-order-items]` `{item.*}` tokens.
- **Timer**: counts down from where the tab left it, then shows `[data-next-timer-expired]`.
