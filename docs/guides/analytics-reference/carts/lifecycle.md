---
title: 'Cart tracking'
group: 'Analytics Reference/Carts'
---

# Cart tracking

Tracking events: `product_removed_from_cart`, `product_added_to_cart`, `cart_updated`.

![Cart tracking: on cart.calculated, on a cart.updated that empties the cart, and on sdk.ready, the cart is compared with the lines already reported; product_removed_from_cart comes for each line lost, product_added_to_cart for each line gained, then cart_updated after a price update](carts-lifecycle.svg)

| Tracking event              | Sent by                                        | When                                               | `dl_*` push                                    |
| --------------------------- | ---------------------------------------------- | -------------------------------------------------- | ---------------------------------------------- |
| `product_removed_from_cart` | `cart.calculated`, `cart.updated`, `sdk.ready` | One per line the cart lost since the last report   | `dl_remove_from_cart`, once per burst of lines |
| `product_added_to_cart`     | `cart.calculated`, `sdk.ready`                 | One per line the cart gained since the last report | `dl_add_to_cart`, once per burst of lines      |
| `cart_updated`              | `cart.calculated`                              | After every price update                           | `dl_cart_updated`                              |

`cart.updated` reports only when it leaves the cart empty, and `sdk.ready` when the page opens with
a priced or an empty cart. One report sends the removals, then the adds, then `cart_updated`.
`first_in_session` is `true` on the first add of the tab; the Meta pixel gets `AddToCart` for that
one only. See [Each event comes once](../how-it-works.md#each-event-comes-once) for what counts
as already reported.
