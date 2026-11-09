---
title: 'Action list'
group: 'Attribute Reference/Actions'
order: 402
---

# Action list

Every action, as `data-next-action="<name>"` and `next.actions.<name>({ … })`.

| Action                        | Arguments                                                                                                                 | Events                                                              |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------- |
| `addItem`                     | `items` (`"1x2, 5"`), or `package_id` and `quantity`, or `selector_id` for its pick; `replace` empties the cart first     | `cart.updated`, `cart.added`                                        |
| `removeItem`                  | `package_id`                                                                                                              | `cart.updated`, `cart.removed`                                      |
| `setQuantity`                 | `quantity` (`"+1"`, `"-1"` or a number) and `package_id` or `selector_id`; `min_quantity`, `max_quantity`                 | `cart.updated` or `selector.updated`                                |
| `select`                      | `selector_id`, `option_id`                                                                                                | `selector.selected`                                                 |
| `selectVariant`               | `code`, `value`, and the option, slot or line it changes; a `variants.<code>` row of `data-next-each` carries all of them | `cart.updated` for an option or line; `selector.updated` for a slot |
| `clear`                       | —                                                                                                                         | `cart.updated`, `cart.removed`                                      |
| `applyCoupon`, `removeCoupon` | `code`                                                                                                                    | `coupon.applied`, `coupon.denied`, `coupon.removed`                 |
| `setShipping`                 | `shipping_id`                                                                                                             | `shipping.selected`                                                 |
| `acceptUpsell`                | `selector_id` or `items`: what the offer adds to the order (on a page opened with `?ref_id`)                              | `upsell.accepted`, `order.updated`                                  |
| `skipUpsell`                  | the same                                                                                                                  | `upsell.skipped`                                                    |
| `go`                          | `url`                                                                                                                     | —                                                                   |

`acceptUpsell` is its own action because it charges the order; `addItem` on an order page fills a
new cart.
