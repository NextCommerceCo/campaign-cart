# Events

`next.on(name, (data, event) => …)`. `'*'` receives every event. A listener added after
`ready` still receives `ready`.

| Event                                                  | Data                             | When                                                      |
| ------------------------------------------------------ | -------------------------------- | --------------------------------------------------------- |
| `ready`                                                | `lines`                          | Once, when the campaign and the page's values are in      |
| `campaign.loaded`                                      | `campaign`, `fromCache`          | Snapshot, then the fresh campaign                         |
| `cart.updated`                                         | `cart`                           | The shopper changed lines, coupons or shipping            |
| `cart.calculated`                                      | `summary`                        | Server totals arrived                                     |
| `selection.changed`                                    | `selectorId`, `cardId`, `items`  | A bundle pick, quantity or slot changed                   |
| `shipping.changed`                                     | `methodId`                       |                                                           |
| `checkout.started`                                     | `lines`                          | Once, when the checkout form is bound                     |
| `checkout.shipping-added`                              | `tier`                           | Once, when the address is complete                        |
| `checkout.payment-added`                               | `method`                         | Once, when payment details are complete                   |
| `prospect.saved`                                       | `cart`, `email`, `phone?`        | Once per tab                                              |
| `order.placed`                                         | `order`                          | The order was created                                     |
| `order.loaded`                                         | `order`, `purchase?`, `upsells?` | On post-purchase pages                                    |
| `upsell.viewed` / `upsell.accepted` / `upsell.skipped` | `refId`, `page` / `lines`        |                                                           |
| `storage.degraded`                                     | `reason`                         | Browser storage is blocked or full                        |
| `exit-intent.*`                                        | popup details                    |                                                           |
| `error`                                                | `action`, `message`              | For analytics and debugging; pages read errors from state |

0.4.x names still work: `bundle:selection-changed`, `cart:updated`,
`shipping:method-changed`, `exit-intent:*`. DOM events kept for page scripts:
`next:initialized`, `next:ready` (window) and `next:prospect-cart-created` (checkout form).

## dataLayer

Analytics pushes 0.4.x `dl_*` events through `window.NextDataLayerTransformFn` (return a
falsy value to drop one) into `window.NextDataLayer`, then into `dataLayer` after
`{ ecommerce: null }`: `dl_user_data`, `dl_view_item(_list)`, `dl_add_to_cart`,
`dl_remove_from_cart`, `dl_package_swapped`, `dl_cart_updated`, `dl_begin_checkout`,
`dl_add_shipping_info`, `dl_add_payment_info`, `dl_purchase` (once, only when paid),
`dl_upsell_purchase`, `dl_viewed_upsell`, `dl_skipped_upsell`. No personal data is sent.
