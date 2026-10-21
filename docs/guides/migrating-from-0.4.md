# Migrating from 0.4.x

Pages built for 0.4.x keep working: old attribute names, `nextConfig` keys and `window.next`
methods are read by each chunk's `legacy.ts` and marked `@deprecated` with their replacement.
This page lists what changes for a page builder.

## Checkout

| 0.4.x                                                                     | Now                                                                                                                               |
| ------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| `data-next-checkout-field="fname"`, `address1`, `postal`, …               | Still read. New pages use the API names: `first_name`, `last_name`, `line1`, `line2`, `city`, `state`, `postcode`, `phone_number` |
| `os-checkout-field`, `os-checkout-element`, `os-checkout-step`            | Still read. Use `data-next-checkout-field`, `data-next-component`, `data-next-checkout-step`                                      |
| `<div data-next-address="shipping\|billing">` (SDK-drawn address)         | **Removed.** Write the fields in HTML like the other templates (apollo-multi-variant is the only campaign using it)               |
| Phone flag dropdown (intl-tel-input, `.iti` CSS)                          | **Removed.** A plain phone input; the number is sent in E.164 from i18n-rules                                                     |
| Google address autocomplete (`nextConfig.googleMaps`)                     | **Removed.** No campaign had an API key set                                                                                       |
| `nextConfig.addressConfig.countries` / `dontShowStates`                   | Still read. The campaign's shipping countries come first                                                                          |
| `nextConfig.paymentConfig.expressCheckout.methodOrder`                    | Still read. The campaign's express methods come first                                                                             |
| `sessionStorage['next-checkout-store']` (step guard)                      | Written in the old shape on multi-step pages, under the exact key the guard script reads                                          |
| `next:prospect-cart-created` on the form                                  | Still fired. Scripts can use `next.on('prospect.saved')`                                                                          |
| `next.getShippingMethods / setShippingMethod / getSelectedShippingMethod` | Still there. Use `next.getState().campaign.shipping_methods` and `next.actions.setShipping(id)`                                   |

## Upsell and receipt

| 0.4.x                                                                                                                                   | Now                                                                                                          |
| --------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| `data-next-upsell="offer"`, `data-next-upsell-action="add\|skip"` (`accept`/`decline`), `next-upsell-accept-url` / `-decline-url` metas | Unchanged                                                                                                    |
| Offer classes `next-available`, `next-hidden`, `next-processing`, `next-success`, `next-error`, `next-skipped`                          | Unchanged                                                                                                    |
| Duplicate-upsell modal ("Already Added!")                                                                                               | **Removed.** An offer already accepted on that page moves on without charging again                          |
| `data-next-action="accept-upsell"` buttons, `data-next-upsell-option`, `data-next-upsell-select`, `data-next-upsell-quantity`           | **Removed** (no live page uses them). Use a bundle selector with `data-next-upsell-context` inside the offer |
| `next.addUpsell`, `canAddUpsells`, `getCompletedUpsells`, `isUpsellAlreadyAdded`                                                        | **Removed** (only the v3 starter MV script used `addUpsell`)                                                 |
| `dl_upsell_purchase` queued in sessionStorage and sent on the next page                                                                 | Sent on the next page from the order's own lines; nothing is queued                                          |
| `dl_purchase` `user_properties` with the customer's email, name and address                                                             | Without personal data; the order id and items are unchanged                                                  |
| `order.*` display paths, `[data-next-order-items]` with `{item.*}` tokens                                                               | The paths and tokens live pages use, unchanged                                                               |
