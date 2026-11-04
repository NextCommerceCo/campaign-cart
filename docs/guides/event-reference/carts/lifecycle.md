---
title: 'Cart lifecycle'
group: 'Event Reference/Carts'
---

# Cart lifecycle

![Cart lifecycle: empty, calculating, priced and unpriced, with the events each step sends](cart-lifecycle.svg)

| State         | Means                                                                                                  |
| ------------- | ------------------------------------------------------------------------------------------------------ |
| `empty`       | No lines                                                                                               |
| `calculating` | The cart changed; the server's prices are on the way                                                   |
| `priced`      | The cart carries the server's prices                                                                   |
| `unpriced`    | Pricing failed: events carry no prices, and the summary still shows the totals from before that change |

| From                                | What happens                                                                                                                   | To            | Events, in order                                                                                                                                                       |
| ----------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ | ------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| none                                | A page opens with a cart saved earlier in this tab, once the campaign is in (from the API, or the saved copy if the API fails) | `calculating` | `cart.calculating`; a package the campaign no longer has is removed first, with `cart.updated`, `cart.removed`                                                         |
| `empty`                             | A package is added                                                                                                             | `calculating` | `cart.updated`, `cart.added`, `cart.calculating`                                                                                                                       |
| `calculating`                       | Another change before the prices arrive                                                                                        | `calculating` | `cart.updated`, then `cart.removed` and `cart.added` for the packages it removed or added; no second `cart.calculating`, and only the latest request's prices are used |
| `calculating`                       | The server prices the cart                                                                                                     | `priced`      | `cart.calculated`, then `shipping.selected` if the shipping method changed                                                                                             |
| `calculating`                       | Pricing fails                                                                                                                  | `unpriced`    | `sdk.error` (`cart.calculate`), then `shipping.selected` without prices if the shipping method changed                                                                 |
| `priced`, `unpriced`                | A package or a quantity changes                                                                                                | `calculating` | `cart.updated`, `cart.removed`, `cart.added` (each only when the change removed or added packages), `cart.calculating`                                                 |
| `priced`, `unpriced`                | A coupon is applied or removed                                                                                                 | `calculating` | `cart.updated`, `coupon.applied` or `coupon.removed`, `cart.calculating`                                                                                               |
| `priced`, `unpriced`                | The shipping method changes                                                                                                    | `calculating` | `cart.updated`, `cart.calculating`; `shipping.selected` comes with the prices                                                                                          |
| `calculating`, `priced`, `unpriced` | The last package is removed, or the cart is cleared                                                                            | `empty`       | `cart.updated`, `cart.removed`; clearing then sends `coupon.removed` for each code                                                                                     |
| `empty`                             | A coupon is removed, or the shipping method changes                                                                            | `empty`       | `cart.updated`, then `coupon.removed` or `shipping.selected` without prices                                                                                            |

`cart.removed` and `cart.added` come once per change, after its `cart.updated`, with the cart
after the change and its `changes`: each package with the quantity it had (`from`) and has (`to`),
and `price` when the cart's last pricing had one. Events that `cart.updated` sets off come between
them, such as `checkout.started` when the first lines reach a checkout page, or the selectors
pricing again when clearing the cart takes its coupons off. A toggle switched on or off sends
`selector.selected` or `selector.deselected` just before the change's `cart.updated`.

`shipping.selected` comes once the cart is priced with the new method: after `cart.calculated`, or
without prices after the `sdk.error` when pricing fails. On an empty cart, or before the campaign
loads, it comes right after `cart.updated`, without prices. A bundle card with its own shipping
method sets it when it is picked.

Before the campaign loads, a change sends `cart.updated`, `cart.removed` and `cart.added` only;
pricing starts once it has loaded. While an order is being placed, from the submit until the order
is placed or fails, the cart is frozen: a change is refused and sends nothing, `applyCoupon`
resolves `false`, and a swap selector keeps its pick. A paid order empties the cart without cart
events; see the order lifecycle.

## Errors

Each sends `sdk.error` with this `action`. The SDK lifecycle lists every action and `code`.

| `action`         | When                      | What the SDK does next                                                      |
| ---------------- | ------------------------- | --------------------------------------------------------------------------- |
| `cart.calculate` | The cart cannot be priced | The cart is `unpriced`; the summary keeps its totals from before the change |
