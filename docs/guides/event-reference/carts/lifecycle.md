---
title: 'Cart lifecycle'
group: 'Event Reference/Carts'
---

# Cart lifecycle

Events: `cart.*`, `shipping.selected`, and with a change `coupon.applied`, `coupon.removed` and a toggle's `selector.selected` or `selector.deselected`.

![Cart lifecycle: empty, calculating, priced and unpriced on one page, with the events each step sends](cart-lifecycle.svg)

The lifecycle is one page's. The cart itself is saved in this tab and comes back on the next page,
where the lifecycle starts again. The debug panel shows whether it is pricing, priced or frozen.

| State         | Means                                                                                                  |
| ------------- | ------------------------------------------------------------------------------------------------------ |
| `empty`       | No lines                                                                                               |
| `calculating` | The cart changed; the server's prices are on the way                                                   |
| `priced`      | The cart carries the server's prices                                                                   |
| `unpriced`    | Pricing failed: events carry no prices, and the summary still shows the totals from before that change |

| From                                | What happens                                                                                                                   | To            | Events, in order                                                                                                                                                                      |
| ----------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ | ------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| none                                | A page opens with no cart saved in this tab, or with `reset=1`                                                                 | `empty`       | none                                                                                                                                                                                  |
| none                                | A page opens with a cart saved earlier in this tab, once the campaign is in (from the API, or the saved copy if the API fails) | `calculating` | `cart.calculating`; a package the campaign no longer has is removed first, with `cart.updated`, `cart.removed`; `empty`, without `cart.calculating`, when none is left                |
| `empty`                             | A package is added                                                                                                             | `calculating` | `cart.updated`, `cart.added`, `cart.calculating`                                                                                                                                      |
| `calculating`                       | Another change before the prices arrive                                                                                        | `calculating` | that change's own events; no second `cart.calculating`, and only the latest request's prices are used                                                                                 |
| `calculating`                       | The server prices the cart                                                                                                     | `priced`      | `cart.calculated`                                                                                                                                                                     |
| `calculating`                       | Pricing fails                                                                                                                  | `unpriced`    | `sdk.error` (`cart.calculate`)                                                                                                                                                        |
| `priced`, `unpriced`                | A package or a quantity changes                                                                                                | `calculating` | a toggle's `selector.selected` or `selector.deselected` first; `cart.updated`, `cart.removed`, `cart.added` (each only when the change removed or added packages), `cart.calculating` |
| `priced`, `unpriced`                | A coupon is applied or removed                                                                                                 | `calculating` | `cart.updated`, `coupon.applied` or `coupon.removed`, `cart.calculating`                                                                                                              |
| `priced`, `unpriced`                | The shipping method changes                                                                                                    | `calculating` | `cart.updated`, `shipping.selected`, `cart.calculating`                                                                                                                               |
| `calculating`, `priced`, `unpriced` | The last package is removed, or the cart is cleared                                                                            | `empty`       | a toggle's `selector.deselected` first; `cart.updated`, `cart.removed`; clearing then sends `coupon.removed` (`reason: 'cleared'`) for each code                                      |
| `empty`                             | A coupon is removed, the cart is cleared, or the shipping method changes                                                       | `empty`       | `cart.updated`, then `coupon.removed` (one per code when cleared) or `shipping.selected`                                                                                              |

## Latest wins

- A change sends its own events together: a toggle's `selector.*`, `cart.updated`,
  `shipping.selected`, `cart.removed`, `cart.added`, then `coupon.applied` or `coupon.removed`.
- Then what other features send because of it, such as `checkout.started` when the first lines
  reach a checkout page or selectors pricing again on a coupon change; `cart.calculating` is last.
- The order is the same when a listener makes the change: its events come after the first change's.
- Changes before the prices arrive each send their own events under one `cart.calculating`; an
  earlier request is cancelled, and only the latest one's prices come, as one `cart.calculated`.

## Before the campaign loads

- A page opens with its saved cart at once: lines, coupons, held codes and the shipping method,
  without prices.
- A change sends `cart.updated`, `cart.removed` and `cart.added` (and `shipping.selected` or a
  toggle's `selector.*`) but no pricing events; pricing starts once the campaign has loaded.
- `?forcePackageId` clears the cart and adds its packages as the SDK starts: the clear's events,
  then `cart.updated`, `cart.added`.
- A coupon entered before the cart can be priced is held and checked after the next
  `cart.calculated`; see the coupon lifecycle.

## Frozen cart

- Frozen while an order is being placed, from the submit until it is placed or fails: a change is
  refused and sends nothing, `applyCoupon` resolves `false`, `removeCoupon` does nothing.
- A swap selector keeps its pick while the cart is frozen.
- A paid order empties it without cart events and keeps it frozen for the rest of the page: at once
  on the checkout page, or where the paid order loads after a gateway. See the order lifecycle.
- The next page starts with an empty cart.

## Shipping

- `shipping.selected` carries the new method without prices (`id` and `code`); its price comes
  with the next `cart.calculated`, as the cart's `shipping_method`.
- Picking the method already selected sends nothing.
- A swap selector's bundle card with its own shipping method sets it when the card is picked.

## What each event carries

- `cart.updated` and `cart.calculating`: the Cart without prices; `cart.calculated`: the Cart
  with the server's prices, numbers in its `currency`.
- `cart.added` and `cart.removed`: the Cart after the change and its `changes`: each package
  with the quantity it had (`from`) and has (`to`), and `price` when the last pricing had one.
- `shipping.selected`: the ShippingMethod without prices.

## Errors

Each sends `sdk.error` with this `action`. The SDK lifecycle lists every action and `code`.

| `action`         | When                      | What the SDK does next                                                                                    |
| ---------------- | ------------------------- | --------------------------------------------------------------------------------------------------------- |
| `cart.calculate` | The cart cannot be priced | The cart is `unpriced`; the summary keeps its totals from before the change; the next change prices again |
