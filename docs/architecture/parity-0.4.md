# Parity with Campaign Cart 0.4.43

October 2026. Every attribute, `window.next` member, event, config key, meta tag, URL
parameter, display path and `dl_*` event the 0.4.43 source reads or writes, checked against
this SDK and against what the live pages in `my-campaigns/_site` use (74 pages, HTML comments
stripped, page scripts included). Limos still pins 0.4.28; its only extra feature, FOMO, left
in 0.4.37 and its pages never reach the call.

How to read the status column:

- **Supported**: same markup, same result.
- **Removed (documented)**: listed in [migrating-from-0.4.md](../guides/migrating-from-0.4.md).
- **Removed (no live use)**: nothing in `my-campaigns` uses it; it is not coming back unless a
  page needs it.
- **Ignored**: read by 0.4.x, harmless to leave on a page.

## Found by this check and fixed

| Gap on live pages                                                                                                                                                                                              | Pages                                      | Fix        |
| -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------ | ---------- |
| `data-next-component="scroll-hint"` never hid                                                                                                                                                                  | 9 receipts                                 | `a2a5a606` |
| `dl_exit_intent_*` not pushed; purchase `event_id` random instead of the transaction id; item ids, sku and discount missing on cart events; skipped upsell without package                                     | 8 checkouts, all post-purchase             | `ee186235` |
| Floating labels (`label.label-checkout.has-value`) never shown                                                                                                                                                 | 10 checkouts                               | `9c0214b2` |
| Express buttons asked for email and name first; 0.4.x placed the express order straight away                                                                                                                   | 9 checkouts                                | `9c0214b2` |
| Card, bump and slot prices came from package data, so campaign offers and card vouchers did not show (warranty bump $3.00 instead of $1.50, limos card $149.99 instead of $75.00, upsell headers without UP50) | 9 checkouts, 12 upsells, 3 variant pickers | `94fed2cc` |
| `bundle.<id>` looked for a selector before a card with that id                                                                                                                                                 | 12 upsells                                 | `94fed2cc` |
| `data-next-package-sync` / `-product-sync` counted lines, not units                                                                                                                                            | 9 checkouts                                | `94fed2cc` |
| Summary lines: no `item.isRecurring` / `{item.frequency}`; `{shipping}` without "Free" before a method; lines not in package order; `{discount.percentage}` rounded                                            | 11 summaries                               | `90c6d2aa` |
| NextCommerce address autocomplete (`addressConfig.enableAutocomplete: true` in every config.js) missing                                                                                                        | 15 checkouts                               | `a3363781` |
| A coupon the server gives nothing for was kept (and `cart.hasCoupon()` turned true); the field was cleared either way                                                                                          | 4 coupon fields, 6 `cart.hasCoupon()`      | `2a515169` |
| `providers.gtm.enabled: false` ignored; `?debug=true` ignored                                                                                                                                                  | 7 configs                                  | `2a515169` |

`bun run e2e` now also checks the autocomplete and a floating label in Chromium. A sweep of
all 72 pages in `bun dev` shows no SDK warning other than the intended "facebook/rudderstack
provider is no longer built in" on apollo-multi-variant. Two page bugs exist in 0.4.43 too:
`next.fomo()` on shop-single-step/checkout and shop-three-step (FOMO left in 0.4.37), and
`initBundleQtyToggle()` on olympus-multi-variant-two-step/upsell-mv (its script is not loaded).

## Open decision

**`nextConfig.currencyBehavior: 'auto'`** (every config.js). 0.4.x looked up the visitor's
country (i18n-rules, up to 3 s before the campaign loaded) and showed prices in that country's
currency when the campaign offers it; the live campaign offers USD, AUD, CAD, EUR and GBP. This
SDK shows the campaign currency unless the URL has `?currency=`. Options: geo lookup after the
first paint and a re-price (flicker for non-US visitors), server-side currency on the campaign
GET (backend ask B5), or keep USD.

## Kept different on purpose

| 0.4.x                                                                                                               | Now                                                                                                              |
| ------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| Money formatted in the browser's locale                                                                             | The campaign's language                                                                                          |
| `page_location` with the query string; `session_id`, `user_agent`, `campaign_id`, `campaign_api_key` on every event | Origin + path; those fields are not sent                                                                         |
| `window.ElevarDataLayer`                                                                                            | Not written (no reader on live pages)                                                                            |
| `dl_view_item_list` rescanned on DOM changes and carried the list into add-to-cart                                  | Sent once on ready                                                                                               |
| 0.4.x storage keys (`next-cart-state__…`)                                                                           | Not migrated: a cart open at the switch is lost, a receipt reloaded right after it may report the purchase again |
| `link` express button                                                                                               | Not drawn (the live campaign offers PayPal and Apple Pay only)                                                   |
| Upsell offer marked `next-hidden` without `ref_id`                                                                  | Left as written (no CSS reads it)                                                                                |
| Cart quantity `decrease` could reach 0                                                                              | Stops at 1; use `data-next-remove-item`                                                                          |
| Coupon applied-code list and messages (`[data-next-coupon="display"]`, `.coupon-messages`)                          | Not drawn (no live page has the hosts); `coupon.refused` fires instead                                           |
| Bundle selectors on upsell pages written into the (finished) cart                                                   | Recorded only                                                                                                    |
| MOCK mode in `bun dev`                                                                                              | Applies no campaign offers; check offer prices with `--api live`                                                 |

## Attributes (145 names in the 0.4.43 source)

| Attribute                                | Live pages | Status                | Note                                                                                        |
| ---------------------------------------- | ---------: | --------------------- | ------------------------------------------------------------------------------------------- |
| `data-next-accordion`                    |         14 | Supported             |                                                                                             |
| `data-next-accordion-panel`              |         14 | Supported             |                                                                                             |
| `data-next-accordion-text`               |         14 | Supported             |                                                                                             |
| `data-next-accordion-trigger`            |         14 | Supported             |                                                                                             |
| `data-next-action`                       |          1 | Supported             |                                                                                             |
| `data-next-active`                       |          0 | Supported             |                                                                                             |
| `data-next-address`                      |          1 | Removed (documented)  | SDK-drawn address form; apollo-multi-variant switches to written fields when it moves       |
| `data-next-address-api`                  |          0 | Removed (documented)  | SDK-drawn address form; apollo-multi-variant switches to written fields when it moves       |
| `data-next-address-field`                |          0 | Removed (documented)  | SDK-drawn address form; apollo-multi-variant switches to written fields when it moves       |
| `data-next-address-lang`                 |          0 | Removed (documented)  | SDK-drawn address form; apollo-multi-variant switches to written fields when it moves       |
| `data-next-address-row`                  |          0 | Removed (documented)  | SDK-drawn address form; apollo-multi-variant switches to written fields when it moves       |
| `data-next-address-state`                |          0 | Removed (documented)  | SDK-drawn address form; apollo-multi-variant switches to written fields when it moves       |
| `data-next-bump`                         |          0 | Removed (no live use) | implicit "is upsell" markers; live bumps use `data-next-is-upsell`                          |
| `data-next-bump-section`                 |          0 | Removed (no live use) | implicit "is upsell" markers; live bumps use `data-next-is-upsell`                          |
| `data-next-bundle-card`                  |         40 | Supported             |                                                                                             |
| `data-next-bundle-display`               |         16 | Supported             | server-priced for every card (fixed in this pass)                                           |
| `data-next-bundle-id`                    |         40 | Supported             |                                                                                             |
| `data-next-bundle-items`                 |         40 | Supported             |                                                                                             |
| `data-next-bundle-name`                  |          0 | Removed (no live use) | cards drawn from JSON / templates; live pages write cards in HTML                           |
| `data-next-bundle-price`                 |          0 | Removed (no live use) | old alias of `data-next-bundle-display`                                                     |
| `data-next-bundle-qty-for`               |         10 | Supported             |                                                                                             |
| `data-next-bundle-selector`              |         40 | Supported             |                                                                                             |
| `data-next-bundle-selector-id`           |          0 | Removed (no live use) | offer pointing at a selector by id; offers use the selector inside them                     |
| `data-next-bundle-slot-template`         |          0 | Supported             |                                                                                             |
| `data-next-bundle-slot-template-id`      |          6 | Supported             |                                                                                             |
| `data-next-bundle-slots`                 |          0 | Removed (no live use) | cards drawn from JSON / templates; live pages write cards in HTML                           |
| `data-next-bundle-slots-for`             |          9 | Supported             |                                                                                             |
| `data-next-bundle-template`              |          0 | Removed (no live use) | cards drawn from JSON / templates; live pages write cards in HTML                           |
| `data-next-bundle-template-id`           |          0 | Removed (no live use) | cards drawn from JSON / templates; live pages write cards in HTML                           |
| `data-next-bundle-vouchers`              |         30 | Supported             | JSON array only (0.4.x also took `A,B`)                                                     |
| `data-next-bundles`                      |          0 | Removed (no live use) | cards drawn from JSON / templates; live pages write cards in HTML                           |
| `data-next-button-text`                  |          0 | Removed (no live use) | toggle button text                                                                          |
| `data-next-cart-item-id`                 |          0 | Removed (no live use) |                                                                                             |
| `data-next-cart-items`                   |          0 | Removed (no live use) | cart item list; use `data-next-cart-summary` + `[data-summary-lines]`                       |
| `data-next-cart-selector`                |          0 | Removed (no live use) |                                                                                             |
| `data-next-cart-summary`                 |         11 | Supported             |                                                                                             |
| `data-next-checkout`                     |         11 | Supported             |                                                                                             |
| `data-next-checkout-field`               |         10 | Supported             | API names and 0.4.x names; floating labels (fixed in this pass)                             |
| `data-next-checkout-payment`             |          0 | Removed (no live use) | old field-scan alias                                                                        |
| `data-next-checkout-review`              |          2 | Supported             |                                                                                             |
| `data-next-checkout-step`                |          2 | Supported             |                                                                                             |
| `data-next-checkout-submit`              |          0 | Supported             |                                                                                             |
| `data-next-class-`                       |          0 | Removed (no live use) | cards drawn from JSON / templates; live pages write cards in HTML                           |
| `data-next-clear-cart`                   |          0 | Supported             |                                                                                             |
| `data-next-component`                    |         21 | Supported             | shipping-field-row, location, `<method>-error`, scroll-hint (fixed), express boxes          |
| `data-next-component-location`           |          0 | Supported             |                                                                                             |
| `data-next-confirm`                      |          0 | Removed (no live use) | remove-item confirm dialog                                                                  |
| `data-next-confirm-message`              |          0 | Removed (no live use) | remove-item confirm dialog                                                                  |
| `data-next-coupon`                       |          4 | Supported             | refused codes stay in the field and are not kept (fixed in this pass); no applied-code list |
| `data-next-default-property`             |          2 | Supported             |                                                                                             |
| `data-next-discounts`                    |         12 | Supported             |                                                                                             |
| `data-next-display`                      |         50 | Supported             |                                                                                             |
| `data-next-enhancer`                     |          2 | Supported             | wrapper not needed: `data-next-checkout-review` works anywhere                              |
| `data-next-error-for`                    |          0 | Supported             |                                                                                             |
| `data-next-exclude-property`             |          2 | Supported             |                                                                                             |
| `data-next-express-checkout`             |          9 | Supported             | paypal, apple_pay, google_pay, shop_pay buttons; not `link`                                 |
| `data-next-fallback`                     |          0 | Supported             |                                                                                             |
| `data-next-format`                       |         38 | Supported             |                                                                                             |
| `data-next-hide`                         |         21 | Supported             |                                                                                             |
| `data-next-i18n`                         |          1 | Removed (documented)  | pages keep their own copy                                                                   |
| `data-next-id`                           |          0 | Supported             | 0.4.x alias of `data-next-selector-id`                                                      |
| `data-next-in-cart`                      |          0 | Supported             |                                                                                             |
| `data-next-include-shipping`             |          4 | Ignored (documented)  | 0.4.x never sent it                                                                         |
| `data-next-is-upsell`                    |          9 | Supported             |                                                                                             |
| `data-next-item-properties`              |         10 | Supported             |                                                                                             |
| `data-next-loading`                      |          0 | Not set               | the `next-loading` class is set instead; no live CSS reads the attribute                    |
| `data-next-max-quantity`                 |         10 | Supported             |                                                                                             |
| `data-next-min-quantity`                 |         10 | Supported             |                                                                                             |
| `data-next-multiply-quantity`            |          0 | Removed (no live use) |                                                                                             |
| `data-next-next-url`                     |          0 | Supported             | upsell buttons                                                                              |
| `data-next-order-items`                  |          9 | Supported             |                                                                                             |
| `data-next-package`                      |          0 | Removed (no live use) | alias of `data-next-package-id` for display context                                         |
| `data-next-package-id`                   |         21 | Supported             |                                                                                             |
| `data-next-package-price`                |          0 | Removed (no live use) | package selector; the bundle selector replaces it                                           |
| `data-next-package-selector`             |          0 | Removed (no live use) | package selector; the bundle selector replaces it                                           |
| `data-next-package-selector-id`          |          0 | Removed (no live use) | offer pointing at a selector by id; offers use the selector inside them                     |
| `data-next-package-sync`                 |          6 | Supported             | counts units, like 0.4.x (fixed in this pass)                                               |
| `data-next-package-template`             |          0 | Removed (no live use) | package selector; the bundle selector replaces it                                           |
| `data-next-package-template-id`          |          0 | Removed (no live use) | package selector; the bundle selector replaces it                                           |
| `data-next-package-toggle`               |          9 | Supported             | container not needed: toggle cards bind on their own                                        |
| `data-next-packages`                     |          0 | Removed (no live use) | package selector; the bundle selector replaces it                                           |
| `data-next-payment-form`                 |          9 | Supported             |                                                                                             |
| `data-next-payment-method`               |          9 | Supported             |                                                                                             |
| `data-next-payment-state`                |          0 | Supported             |                                                                                             |
| `data-next-phone-country`                |          0 | Removed (documented)  | phone flag widget                                                                           |
| `data-next-phone-e164`                   |          0 | Removed (documented)  | phone flag widget                                                                           |
| `data-next-product-sync`                 |          3 | Supported             | counts units, like 0.4.x (fixed in this pass)                                               |
| `data-next-property`                     |          4 | Supported             |                                                                                             |
| `data-next-property-container`           |          0 | Removed (no live use) |                                                                                             |
| `data-next-quantity`                     |         19 | Supported             | card / bump / offer quantity; `increase` / `decrease` in summaries (min is now 1, was 0)    |
| `data-next-quantity-decrease`            |         10 | Supported             | bundle quantity stepper                                                                     |
| `data-next-quantity-display`             |         10 | Supported             |                                                                                             |
| `data-next-quantity-increase`            |         10 | Supported             | bundle quantity stepper                                                                     |
| `data-next-quantity-selector-id`         |          0 | Removed (no live use) | package selector; the bundle selector replaces it                                           |
| `data-next-quantity-text`                |          0 | Removed (no live use) |                                                                                             |
| `data-next-remove-item`                  |          0 | Supported             |                                                                                             |
| `data-next-required`                     |          0 | Supported             |                                                                                             |
| `data-next-scroll-target`                |          0 | Supported             | scroll hint (fixed in this pass)                                                            |
| `data-next-scroll-threshold`             |          0 | Supported             | scroll hint (fixed in this pass)                                                            |
| `data-next-sdk-loading`                  |          0 | Not set               | `html[data-next-ready]` / `next-display-ready` instead; no live CSS reads it                |
| `data-next-selected`                     |         40 | Supported             |                                                                                             |
| `data-next-selection-mode`               |         10 | Supported             | forced to `select` on upsell pages (0.4.x wrote the pick into the cart there)               |
| `data-next-selector-card`                |          0 | Removed (no live use) | package selector; the bundle selector replaces it                                           |
| `data-next-selector-id`                  |         40 | Supported             |                                                                                             |
| `data-next-shipping-id`                  |         10 | Supported             |                                                                                             |
| `data-next-show`                         |         20 | Supported             |                                                                                             |
| `data-next-slot-index`                   |          0 | Removed (no live use) | cards drawn from JSON / templates; live pages write cards in HTML                           |
| `data-next-step-number`                  |          2 | Supported             |                                                                                             |
| `data-next-timer`                        |          0 | Removed (no live use) | countdown; pages run their own timer script                                                 |
| `data-next-timer-display`                |          0 | Removed (no live use) | countdown; pages run their own timer script                                                 |
| `data-next-timer-expired`                |          0 | Removed (no live use) | countdown; pages run their own timer script                                                 |
| `data-next-toggle`                       |          2 | n/a                   | only the 0.4.x debug overlay read it                                                        |
| `data-next-toggle-card`                  |          9 | Supported             |                                                                                             |
| `data-next-toggle-container`             |          0 | Supported             |                                                                                             |
| `data-next-toggle-display`               |          9 | Supported             | server-priced (fixed in this pass)                                                          |
| `data-next-toggle-image`                 |          9 | Supported             |                                                                                             |
| `data-next-toggle-price`                 |          0 | Removed (no live use) | toggle cards drawn from JSON / templates                                                    |
| `data-next-toggle-template`              |          0 | Removed (no live use) | toggle cards drawn from JSON / templates                                                    |
| `data-next-toggle-template-id`           |          0 | Removed (no live use) | toggle cards drawn from JSON / templates                                                    |
| `data-next-tooltip`                      |          9 | Supported             | `-placement` ignored                                                                        |
| `data-next-tooltip-class`                |          0 | Supported             |                                                                                             |
| `data-next-tooltip-delay`                |          0 | Supported             |                                                                                             |
| `data-next-tooltip-max-width`            |          0 | Supported             |                                                                                             |
| `data-next-tooltip-offset`               |          0 | Supported             |                                                                                             |
| `data-next-tooltip-placement`            |          0 | Ignored (documented)  | tooltip goes above, or below when there is no room                                          |
| `data-next-tracking-tag`                 |          0 | Removed (no live use) | `<meta name="data-next-tracking-tag">` attribution tags                                     |
| `data-next-upsell`                       |         30 | Supported             |                                                                                             |
| `data-next-upsell-action`                |         30 | Supported             |                                                                                             |
| `data-next-upsell-action-for`            |          0 | Removed (no live use) | old upsell selector UI; use a bundle selector with `data-next-upsell-context`               |
| `data-next-upsell-context`               |         30 | Supported             |                                                                                             |
| `data-next-upsell-item`                  |          0 | Removed (no live use) | implicit "is upsell" markers; live bumps use `data-next-is-upsell`                          |
| `data-next-upsell-option`                |          0 | Removed (documented)  | old upsell selector UI                                                                      |
| `data-next-upsell-quantity`              |          0 | Removed (documented)  | old upsell selector UI                                                                      |
| `data-next-upsell-quantity-toggle`       |          0 | Removed (no live use) | old upsell selector UI; use a bundle selector with `data-next-upsell-context`               |
| `data-next-upsell-section`               |          0 | Removed (no live use) | implicit "is upsell" markers; live bumps use `data-next-is-upsell`                          |
| `data-next-upsell-select`                |          0 | Removed (documented)  | old upsell selector UI                                                                      |
| `data-next-upsell-selector`              |          0 | Removed (no live use) | old upsell selector UI; use a bundle selector with `data-next-upsell-context`               |
| `data-next-url`                          |          0 | Supported             |                                                                                             |
| `data-next-validate`                     |          0 | n/a                   | only the 0.4.x DOM observer watched it                                                      |
| `data-next-variant-code`                 |          0 | Supported             |                                                                                             |
| `data-next-variant-option`               |          0 | Removed (no live use) | cards drawn from JSON / templates; live pages write cards in HTML                           |
| `data-next-variant-option-template-id`   |          0 | Removed (no live use) | cards drawn from JSON / templates; live pages write cards in HTML                           |
| `data-next-variant-options`              |          0 | Removed (no live use) | cards drawn from JSON / templates; live pages write cards in HTML                           |
| `data-next-variant-selector-template-id` |          0 | Removed (no live use) | cards drawn from JSON / templates; live pages write cards in HTML                           |
| `data-next-variant-selectors`            |          6 | Supported             |                                                                                             |

Attributes live pages use that 0.4.43 never read either (page kit, page scripts or CSS):
`data-next-await` (42 pages, CSS waits for `next-display-ready`), `data-next-skeleton` (9,
shipped CSS), `data-next-catalog-component` (54), `data-next-content` (9), `data-next-bind` (3),
`data-next-element="timer"` (2, page timer), `data-next-modal-close` (2, page modal),
`data-os-cart-summary` (6), `data-os-component="location"` (7).

## `window.next`

| 0.4.x member                                                                                                                                                                                                        | Live uses | Status                                                                                                     |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------: | ---------------------------------------------------------------------------------------------------------- |
| `on`                                                                                                                                                                                                                |        97 | Supported: new names plus the 0.4.x aliases below                                                          |
| `exitIntent`                                                                                                                                                                                                        |        18 | Supported; resolves a function that removes it (was `disableExitIntent`)                                   |
| `applyCoupon`                                                                                                                                                                                                       |         8 | Supported; resolves `false` for a refused code (was `{ success, message }`)                                |
| `addItem`, `clearCart`, `swapCart`, `getCartData`, `getPackage`                                                                                                                                                     |    6 each | Supported (variant picker)                                                                                 |
| `getShippingMethods`, `setShippingMethod`, `getSelectedShippingMethod`                                                                                                                                              |         3 | Supported (shop-three-step shipping script)                                                                |
| `getCampaignData`                                                                                                                                                                                                   |         0 | Supported                                                                                                  |
| `cart` (store: `clear`, `addPackage`, …), `NextCommerce.getInstance()`                                                                                                                                              |        12 | Removed; every live use is a fallback after `swapCart` / `window.next`, never reached                      |
| `fomo`                                                                                                                                                                                                              |        11 | Removed in 0.4.37; 9 calls sit after a `return`                                                            |
| `removeItem`, `updateQuantity`, `removeCoupon` (top level)                                                                                                                                                          |         0 | Removed: `next.actions.removeItem` / `setQuantity` / `removeCoupon`                                        |
| `hasItemInCart`, `getCartTotals`, `getCartCount`, `getCoupons`                                                                                                                                                      |         0 | Removed: `next.getState().cart`                                                                            |
| `getVariantsByProductId`, `getAvailableVariantAttributes`, `getPackageByVariantSelection`, `createVariantKey`                                                                                                       |         0 | Removed: `campaign.packages[].product_variant_attribute_values` (only the v3 starter MV scripts call them) |
| `addUpsell`, `canAddUpsells`, `getCompletedUpsells`, `isUpsellAlreadyAdded`                                                                                                                                         |         0 | Removed (documented)                                                                                       |
| `off`                                                                                                                                                                                                               |         0 | Removed: `next.on` returns the unsubscribe function                                                        |
| `registerCallback`, `unregisterCallback`, `triggerCallback`                                                                                                                                                         |         0 | Removed (0.4.43 never triggered them)                                                                      |
| `trackViewItemList`, `trackViewItem`, `trackAddToCart`, `trackRemoveFromCart`, `trackBeginCheckout`, `trackPurchase`, `trackCustomEvent`, `trackSignUp`, `trackLogin`, `setDebugMode`, `invalidateAnalyticsContext` |         0 | Removed: events are sent from the engine; page events go to `dataLayer`                                    |
| `addMetadata`, `setMetadata`, `clearMetadata`, `getMetadata`, `setAttribution`, `getAttribution`, `debugAttribution`                                                                                                |         0 | Removed: attribution is captured on entry (`next.getState().visit`)                                        |
| `setParam`, `setParams`, `getParam`, `getAllParams`, `hasParam`, `clearParam`, `clearAllParams`, `mergeParams`                                                                                                      |         0 | Removed: `next.getState().visit.params`                                                                    |
| `getVersion`, `formatPrice`, `validateCheckout`                                                                                                                                                                     |         0 | Removed: `next.version`; formatting and validation stay inside the SDK                                     |
| `window.nextReady`, `next:initialized`, `next:ready`, `html.next-display-ready`                                                                                                                                     |   26 / 72 | Supported                                                                                                  |
| `window.NextDataLayer`, `NextDataLayerTransformFn`                                                                                                                                                                  | forwarder | Supported                                                                                                  |

## Events

`next.on` aliases kept: `bundle:selection-changed` (7 pages), `cart:updated`,
`coupon:validation-failed`, `shipping:method-changed`, `exit-intent:shown` / `clicked` /
`dismissed` / `closed` / `action`. Every other 0.4.43 `EventMap` key (75) has no live
listener; the ones with a new counterpart: `checkout:started` → `checkout.started`,
`order:completed` → `order.loaded`, `upsell:accepted` / `skipped` / `viewed` →
`upsell.*`, `error:occurred` → `error`, `campaign:loaded` → `campaign.loaded`. The rest
(`cart:item-added`, `selector:*`, `toggle:*`, `payment:*`, `express-checkout:*`,
`checkout:payment-ready`, `accordion:*`, `timer:expired`, `scroll-hint:updated`, …) are gone; an
unknown name logs a warning. DOM events kept: `next:initialized`, `next:ready`,
`next:prospect-cart-created`. Gone: `next:display-ready`, `next:prospect-cart-abandoned`,
`next:*:price-updated`.

## Config, meta tags and URL parameters

| 0.4.x                                                                                                                                                       | Status                                                                                                   |
| ----------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| `apiKey`, `addressConfig.countries` / `dontShowStates` / `enableAutocomplete`, `paymentConfig.expressCheckout.methodOrder`                                  | Supported                                                                                                |
| `analytics.enabled`, `providers.nextCampaign`, `providers.gtm.enabled`                                                                                      | Supported (a missing block now means on)                                                                 |
| `paymentConfig.expressCheckout.requireValidation` / `requiredFields`                                                                                        | Fixed to email, first and last name for an express method chosen in the form; buttons skip it, as before |
| `currencyBehavior`                                                                                                                                          | **Open** (see above)                                                                                     |
| `googleMaps`                                                                                                                                                | Removed (documented; every key is empty)                                                                 |
| `utmTransfer`, `analytics.mode`, `storeName`, `providers.facebook` / `rudderstack` / `custom`                                                               | Ignored; same-site links always carry attribution; vendors go through GTM                                |
| `debug`, `locale`, `translations`, `discounts`, `tracking`, `cardInputConfig`, `storageScope`, `productTitleMap`                                            | Removed (no live use)                                                                                    |
| `next-funnel`, `next-success-url`, `next-next-url`, `os-next-page`, `next-failure-url`, `next-upsell-accept-url`, `next-upsell-decline-url`, `next-api-key` | Supported                                                                                                |
| `next-page-type`                                                                                                                                            | Not needed: offers mark the upsell page themselves                                                       |
| `next-campaign-id`, `next-debug`, `next-clear-cart`, `next-storage-scope`, `os-tracking-tag`, `next-analytics-*`                                            | Removed (no live use)                                                                                    |
| `?ref_id`, `?forcePackageId`, `?payment_failed`, `?currency`, `?funnel`, `utm_*` and click ids, `param.*` conditions                                        | Supported                                                                                                |
| `?debug=true`, `?debugger=true`, `?reset=true`                                                                                                              | Supported (also `?debug=1`, `?reset=1`)                                                                  |
| `?country`                                                                                                                                                  | Sets the checkout country; no currency switch                                                            |
| `?forceShippingId`, `?forceBundleId`, `?test`, `?ignore`                                                                                                    | Removed (no live use)                                                                                    |

## Display paths and conditions

Every path, token and condition a live page uses resolves. By namespace:

- **`cart.*`**: all live paths. Gone: `cart-summary.*`, `shippingName` / `shippingCode` (use
  `shipping.name` / `.code`), shipping-discount fields, coupon lists. `totalQuantity` counts units.
- **`package.*`, `campaign.*`**: all live paths. Gone: raw API fields, `unit*` savings, `*.raw`,
  `interval`, `isBundle`.
- **`bundle.*`, `data-next-bundle-display`, `toggle.*`, `data-next-toggle-display`**: all props,
  server-priced. Gone: `currency`, and the toggle's ids, names and recurring fields.
- **`order.*` and `{item.*}` order tokens**: all live paths. Gone: `statusUrl`, `createdAt`,
  `lines[N].*`, `attribution.*`, `isTest`, tax and discount per line.
- **`shipping.*`**: the selected method, not the one next to a `[data-next-shipping-id]` row.
- **`selection.*`, `selector.*`, `[data-next-package-price]`, `[data-next-cart-items]` tokens,
  JSON card and toggle templates**: gone (no live use).
- **Formats**: `currency`, `percentage` (whole numbers; 0.4.x multiplied values up to 1 by 100),
  `address`, `phone`. Gone: `number`, `boolean`, `date`, `text`, `data-hide-if-zero`,
  `data-divide-by`, `data-multiply-by`.
- **Conditions**: `path`, `!path`, `path()`, `== 'x'`, `!= 'x'`. Gone: `&&`, `||`, parentheses,
  `>` / `<`, `cart.hasItem(id)`, `param.has()`. An unknown path leaves the element as written
  and logs a warning.
