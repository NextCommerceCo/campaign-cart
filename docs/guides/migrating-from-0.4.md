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
