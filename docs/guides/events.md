# Events

`next.on(name, (data, event) => …)`. `'*'` receives every event. A listener added after
`ready` still receives `ready`.

| Event                                                  | Data                                      | When                                                                                     |
| ------------------------------------------------------ | ----------------------------------------- | ---------------------------------------------------------------------------------------- |
| `ready`                                                | `lines`                                   | Once, when the campaign and the page's values are in                                     |
| `campaign.loaded`                                      | `campaign`, `fromCache`                   | Snapshot, then the fresh campaign                                                        |
| `cart.updated`                                         | `cart`                                    | The shopper changed lines, coupons or shipping                                           |
| `cart.calculated`                                      | `summary`                                 | Server totals arrived                                                                    |
| `coupon.refused`                                       | `code`                                    | The server gives no discount for a code; it is not kept                                  |
| `selection.changed`                                    | `selectorId`, `cardId`, `items`           | A bundle pick, quantity or slot changed                                                  |
| `shipping.changed`                                     | `methodId`                                |                                                                                          |
| `checkout.started`                                     | `lines`                                   | Once, when the checkout form is bound                                                    |
| `checkout.shipping-added`                              | `tier`                                    | Once, when the address is complete                                                       |
| `checkout.payment-added`                               | `method`                                  | Once, when payment details are complete                                                  |
| `prospect.saved`                                       | `cart`, `email`, `phone?`                 | Once per tab                                                                             |
| `order.placed`                                         | `order`                                   | The order was created                                                                    |
| `order.loaded`                                         | `order`, `purchase?`, `upsells?`          | On post-purchase pages                                                                   |
| `upsell.viewed` / `upsell.accepted` / `upsell.skipped` | `refId`, `page` / `lines`                 |                                                                                          |
| `storage.degraded`                                     | `reason`                                  | Browser storage is blocked or full                                                       |
| `exit-intent.*`                                        | popup details                             |                                                                                          |
| `error`                                                | `action`, `message`                       | For analytics and debugging; pages read errors from state                                |
| `analytics`                                            | `name`, `id`, `time`, `params`, `context` | Each analytics event, under its GA4 name; see below; late listeners get the earlier ones |

0.4.x names still work: `bundle:selection-changed`, `cart:updated`, `coupon:validation-failed`,
`shipping:method-changed`, `exit-intent:*`. Other 0.4.x names log a warning and never fire. DOM events kept for page scripts:
`next:initialized`, `next:ready` (window) and `next:prospect-cart-created` (checkout form).

## Analytics

`next.on('analytics', (event) => …)` receives each analytics event once the analytics chunk has
loaded (on idle after `ready`), including those sent before the listener was added. Forward them
to any vendor from here.

| `name`                                   | `params`                                                                                                 |
| ---------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| `page_view`                              | `page_location`, `page_title`, `page_referrer`                                                           |
| `view_item`, `remove_from_cart`          | `currency`, `value`, `items`                                                                             |
| `add_to_cart`                            | `currency`, `value`, `items`, `first_in_session`                                                         |
| `view_item_list`                         | `currency`, `items`, `item_list_id`, `item_list_name`                                                    |
| `update_cart`, `begin_checkout`          | the cart: `currency`, `value`, `items`, `coupon?`, `shipping?`                                           |
| `add_shipping_info` / `add_payment_info` | the cart plus `shipping_tier` / `payment_type`                                                           |
| `purchase`                               | `currency`, `transaction_id`, `value`, `tax`, `shipping`, `affiliation`, `items`, `coupon?`, `discount?` |
| `upsell_purchase`                        | as `purchase`, plus `upsell: { original_order_id, upsell_number, package_id, package_name }`             |
| `view_upsell` / `skip_upsell`            | `order_id`, `page_path`, `currency` / `order_id`, `package_id?`, `package_name?`                         |

Names and `params` follow GA4 ecommerce; `update_cart`, `upsell_purchase`,
`view_upsell` and `skip_upsell` have no GA4 equivalent. `items` carry GA4 item fields (`item_id`,
`item_name`, `item_variant`, `price`, `discount`, `quantity`, `index`, …). `id` is unique per
event, and is the transaction id for `purchase` and `upsell_purchase`; `purchase` is sent once, only
when paid. `context` has `page_location`, `page_title`, `page_referrer`, `campaign_name`,
`campaign_currency`, `campaign_language` and `attribution`. No personal data is sent.

`add_to_cart` and `remove_from_cart` compare the priced cart with what earlier events in the tab
already reported, on `ready` and after each server calculation. A cart filled before the page
loaded (a default bundle, `forcePackageId`, `forceBundleId`, a redirect from an add-to-cart button)
sends `add_to_cart` at the cart price; a bundle change sends `remove_from_cart` for the old lines,
at the price they were added, and `add_to_cart` for the new ones. `first_in_session` is `true` on
the first `add_to_cart` of the tab, for tags that send only one AddToCart.

## dataLayer (deprecated)

Use `next.on('analytics')`. Each analytics event is still pushed in the 0.4.x Elevar format, with
the same `id` as `event_id`, for GTM containers and forwarders that read it. Analytics pushes 0.4.x `dl_*` events through `window.NextDataLayerTransformFn` (return a
falsy value to drop one) into `window.NextDataLayer`, then into `dataLayer` after
`{ ecommerce: null }`: `dl_user_data`, `dl_view_item(_list)`, `dl_add_to_cart`,
`dl_remove_from_cart`, `dl_cart_updated`, `dl_begin_checkout`,
`dl_add_shipping_info`, `dl_add_payment_info`, `dl_purchase` (once, only when paid),
`dl_upsell_purchase`, `dl_viewed_upsell`, `dl_skipped_upsell`, `dl_exit_intent_shown` /
`_accepted` / `_dismissed` / `_closed` / `_action`. No personal data is sent. `dl_add_to_cart` carries
`first_in_session` at the top level. The purchase
events use the transaction id as `event_id`, as 0.4.x did. `nextConfig.analytics.providers.gtm.enabled: false`
keeps events out of `dataLayer` (only `NextDataLayer`).
