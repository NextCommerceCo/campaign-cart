---
title: 'Start Here/Migrating from 0.4.x'
group: 'Start Here'
category: 'Start Here'
order: 2
---

# Migrating from 0.4.x

**A 0.4.x page keeps working.** Old attributes, `nextConfig` keys, `window.next` methods and event
names are still read.

The new names this page points to are the first 0.5 attributes, which keep working too. New pages
use the attribute set in the [Attribute Reference](attributes.md); [Legacy
attributes](attribute-reference/legacy/legacy-attributes.md) maps each 0.5 name to it.

What to check, in order:

1. [Removed](#removed): fix these if your page uses them.
2. [Works differently](#works-differently): no change needed, but behavior moved.
3. [Deprecated](#deprecated): still works; use the new name on new pages.
4. [Unchanged](#unchanged): nothing to do.

Every 0.4.43 attribute, method, event and config key is listed in
[parity-0.4.md](../architecture/parity-0.4.md).

## Removed

| 0.4.x                                                                                                                 | What to do                                                                                                                                         |
| --------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| `data-prospect-config`, `data-min-phone-digits`, `data-email-field`, `data-phone-field` (logs a warning)              | Set [`data-next-lead`](attribute-reference/objects/checkout.md); mark inputs with `data-next-checkout-field`. The address service checks the phone |
| `data-next-action="accept-upsell"`, `data-next-upsell-option`, `data-next-upsell-select`, `data-next-upsell-quantity` | Put a bundle selector with `data-next-upsell-context` inside the offer                                                                             |
| Duplicate-upsell modal ("Already Added!")                                                                             | Nothing: an offer already accepted on that page moves on without charging again                                                                    |
| `nextConfig.googleMaps` (Google address autocomplete)                                                                 | Nothing: no campaign had an API key set                                                                                                            |
| Events `cart:package-swapped`, `order:redirect-missing`, `address:messages-loaded` (`next.on` warns)                  | Remove the listener                                                                                                                                |
| Event `upsell:accepted`                                                                                               | Listen for `upsell:added`                                                                                                                          |
| `dl_package_swapped`                                                                                                  | A bundle change now sends `dl_remove_from_cart` + `dl_add_to_cart`                                                                                 |
| `token` and `pmData` on `payment:tokenized`                                                                           | The event still fires without them; a warning says so once a page                                                                                  |

## Works differently

### Checkout

- **Express buttons** place the order without checking the form, as in 0.4.x.
  - PayPal, Apple Pay or Google Pay chosen _in the form_ checks what
    `nextConfig.paymentConfig.expressCheckout.requireValidation` asks: the `requiredFields`
    listed, the whole form when none are listed, nothing when it is `false`. Unset, the whole
    form. It sends the shopper's details.
  - Klarna and the other redirect methods chosen in the form get the form's full checks.
- **Coupon on an empty cart** is checked once the cart is first priced. `next.applyCoupon` still
  answers `true` at once.
- **Phone placeholder**: the page's own is kept (0.4.43 replaced it with `Phone*`).
- **`data-next-address`**: `-lang` and `-api` are not read.
- **`addressConfig.countries` / `dontShowStates`**: only the campaign's shipping countries that
  are also in the list are offered.
- **`expressCheckout.methodOrder`**: only the campaign's express methods in the list show, in
  its order.
- **`data-next-include-shipping`** is ignored. 0.4.x never sent it to the API either.
- **A declined card** shows `payment.errors.<code>`, or `payment.errors.generic` for a code with no
  sentence of its own ([Language](attribute-reference/setup/language.md)). 0.4.43 showed the
  gateway's English wording (`payment_details`) for such a code; it is no longer shown.

### Events

- `checkout:started` still comes on every checkout page; the new `checkout.started` comes once per
  checkout.
- `next.exitIntent()` also takes `id` and `name`, which reach `promotion_viewed` and
  `promotion_selected`.

### dataLayer

- `dl_begin_checkout`, `dl_add_shipping_info`, `dl_add_payment_info`: once per checkout. A later
  step, a reload or a return from the payment gateway does not send them again.
  `dl_add_shipping_info` is sent when the shipping address is valid, after `dl_begin_checkout`; a
  shipping method priced before that (a bundle card with `data-next-shipping-id`) does not send it.
- `dl_add_to_cart` is now sent for a cart filled before the page loaded (default bundle,
  `forcePackageId`, `forceBundleId`, a redirecting add-to-cart button), at the cart price.
  Filter on `first_in_session` to send one AddToCart per tab. The Meta destination does this itself.
- The Meta destination sends `PageView` itself, as 0.4.x did: a page whose pixel base code keeps
  `fbq('track', 'PageView')` sends it twice, so remove that line.
- `dl_upsell_purchase` is sent on the next page from the order's own lines; nothing is queued in
  sessionStorage. As in 0.4.x, a line the order was paid with (an order bump with
  `data-next-is-upsell="true"`) is in `dl_purchase`, not a `dl_upsell_purchase`.
- `user_properties` carries the customer's email, name, phone and billing address on `dl_purchase`
  and `dl_upsell_purchase` only, from the order. Every other `dl_*` event has
  `{ visitor_type: 'guest' }`.
- `dl_purchase`:
  - No URL query strings in `page_referrer` / `attribution.metadata`.
  - Same `transaction_id`, value, tax basis (picked per order, as 0.4.x did), `item_sku`, per-item
    `discount`, `item_brand` and `coupon`.

### Widgets

- `data-next-tooltip`: same look, placed above (or below when there is no room) without
  floating-ui. `-placement` is ignored.

## Deprecated

Still works. Use the right column on new pages.

| 0.4.x                                                                                                                                                                      | Use instead                                                                                                                                                                                                                                                               |
| -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `data-next-checkout-field="fname"`, `address1`, `postal`, …                                                                                                                | `first_name`, `last_name`, `line1`, `line2`, `city`, `state`, `postcode`, `phone_number`                                                                                                                                                                                  |
| `os-checkout-field`, `os-checkout-element`, `os-checkout-step`                                                                                                             | `data-next-checkout-field`, `data-next-component`, `data-next-checkout-step`                                                                                                                                                                                              |
| `data-trigger-on`, `data-auto-create="false"` on the form                                                                                                                  | [`data-next-lead`](attribute-reference/objects/checkout.md): `email`, `phone`, `email+phone`, `off`                                                                                                                                                                       |
| `next:prospect-cart-created` on the form                                                                                                                                   | `next.on('user.created')`                                                                                                                                                                                                                                                 |
| `next.getShippingMethods / setShippingMethod / getSelectedShippingMethod`                                                                                                  | Read `next.snapshot().cart.shipping_method`; set with `next.actions.setShipping(id)`                                                                                                                                                                                      |
| `data-next-upsell-quantity-toggle` on the offer                                                                                                                            | `data-next-quantity` on the offer, or a bundle selector inside it                                                                                                                                                                                                         |
| `next.addUpsell`, `canAddUpsells`, `getCompletedUpsells`, `isUpsellAlreadyAdded`, `getAvailableVariantAttributes`, `getPackageByVariantSelection` (on post-purchase pages) | `data-next-upsell-action="add"` on an offer, or `next.actions.acceptUpsell({ items: '12x2' })`                                                                                                                                                                            |
| `data-next-bundle-selector-id` on the offer                                                                                                                                | Put the `[data-next-bundle-selector]` inside `[data-next-upsell]`                                                                                                                                                                                                         |
| `next.on('cart:updated')` and the other 0.4.x event names                                                                                                                  | The [Event Reference](events.md) names. The old ones still fire with their 0.4.43 payloads                                                                                                                                                                                |
| `dl_*` in `window.dataLayer` / `NextDataLayer`, `NextDataLayerTransformFn`                                                                                                 | `next.analytics.on(name, fn)` with the [tracking names](/analytics): `dl_add_to_cart` → `product_added_to_cart`, `dl_purchase` → `checkout_completed`, `dl_user_data` → `page_viewed`, …                                                                                  |
| `nextConfig.analytics.providers.gtm.enabled`, `providers.facebook.enabled`, `nextConfig.storeName`                                                                         | `nextConfig.analytics.destinations.gtm.enabled`, `destinations.meta.enabled` and `destinations.meta.storeName` ([Destinations](analytics-reference/destinations/overview.md#config)). The Meta pixel is built in again, and the 0.4.x keys still turn GTM off and Meta on |
| `nextConfig.analytics.providers.rudderstack.enabled`                                                                                                                       | `nextConfig.analytics.destinations.rudderstack.enabled` ([RudderStack](analytics-reference/destinations/rudderstack.md)): the same calls, event names and properties as 0.4.x. The 0.4.x key still turns it on                                                            |
| `nextConfig.analytics.providers.custom`                                                                                                                                    | A listener: `next.analytics.on('*', (event) => fetch(url, { method: 'POST', keepalive: true, body: JSON.stringify(event) }))` ([By hand](analytics-reference/destinations/overview.md#by-hand))                                                                           |
| `data-next-timer`, `data-next-accordion`, `data-next-tooltip`, `data-next-component="scroll-hint"`                                                                         | Your own script or CSS: `<details>` for an accordion, `title` or CSS for a tooltip                                                                                                                                                                                        |

`data-next-i18n`, `nextConfig.locale` and `nextConfig.translations` work as in 0.4.x, by the same
keys; see [Language](attribute-reference/setup/language.md). Without `locale`, prices and the
checkout follow the campaign's language (0.4.x: the browser's for prices, English for the checkout).

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
