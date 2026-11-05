---
title: 'Selector lifecycle'
group: 'Event Reference/Selectors'
---

# Selector lifecycle

Events: `selector.*`.

![Selector lifecycle: picked, calculating, priced and unpriced, with the events each step sends](selector-lifecycle.svg)

An option is a card in a selector (`data-next-bundle-card`); `option_id` is its `data-next-bundle-id`.

| State         | Means                                                                          |
| ------------- | ------------------------------------------------------------------------------ |
| `picked`      | The selector is on the page and an option is picked                            |
| `calculating` | The options with no price from the last 10 minutes are being priced            |
| `priced`      | Every option has a price                                                       |
| `unpriced`    | Pricing failed; each option keeps its last price, else shows its package price |

| From                                | What happens                                                                                                                           | To                                                                    | Events, in order                                                                                                        |
| ----------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| none                                | The selector is bound and picks its option: `?forceBundleId`, the one in the cart, `data-next-selected`, else the first                | `picked`                                                              | none                                                                                                                    |
| any                                 | Half of the selector comes on screen                                                                                                   | same state                                                            | `selector.viewed`, once per selector on the page                                                                        |
| `picked`                            | Some options have no price from the last 10 minutes                                                                                    | `calculating`                                                         | `selector.calculating`                                                                                                  |
| `picked`                            | Every option has a price from the last 10 minutes                                                                                      | `priced`                                                              | `selector.calculated`                                                                                                   |
| `calculating`                       | The prices arrive                                                                                                                      | `priced`                                                              | `selector.calculated`                                                                                                   |
| `calculating`                       | Pricing fails                                                                                                                          | `unpriced`                                                            | `sdk.error` (`selector.calculate`)                                                                                      |
| `priced`                            | Prices from the last 10 minutes are checked again, once a page                                                                         | `priced`                                                              | `selector.calculated` with the fresh prices; if the check fails, `sdk.error` (`selector.calculate`) and the prices stay |
| any                                 | Another option is picked                                                                                                               | same state                                                            | `selector.selected`                                                                                                     |
| `calculating`, `priced`, `unpriced` | The picked option's quantity changes, or a slot of the picked option (one unit of a configurable line) changes its variant or property | `calculating`, or `priced` if every price is from the last 10 minutes | `selector.updated`, then `selector.calculating` or `selector.calculated`                                                |
| `calculating`, `priced`, `unpriced` | The cart's coupons change                                                                                                              | as above                                                              | `selector.calculating` or `selector.calculated`, after the change's own events                                          |

In swap mode, the default, picking also puts the option in the cart, so `cart.updated` follows;
so does a quantity or slot change, after `selector.updated`. While an order is being placed the
cart is frozen: a swap selector ignores picks, quantity and slot changes and sends nothing.
Markup bound again under the same selector id, such as with `next.bind`, sends no second
`selector.viewed`; it sends `selector.selected` if its pick changed.

Prices are kept 10 minutes in this browser. A later page shows them at once with
`selector.calculated`, checks them once in the background without `selector.calculating`, and
sends `selector.calculated` again when the fresh prices arrive.

Every selector event carries the same `Selector`: the picked option and its lines, with the
product as in the cart, priced once the option has a price, and every option with its price. The
price that is paid comes with the cart on `cart.*`.

A toggle (a bump such as a warranty) has `type: 'toggle'` and no options, and follows the same
lifecycle: `selector.viewed` when half of it is on screen, and `selector.calculating` and
`selector.calculated` while its line is priced as if added. It sends `selector.selected` when it is
switched on, and `selector.deselected` when its line leaves the cart: switched off from its card,
removed, set to 0, or the cart cleared. Both come just before the change's `cart.updated`. Once on,
its price comes with the cart on `cart.*`.

## Errors

Each sends `sdk.error` with this `action`. The SDK lifecycle lists every action and `code`.

| `action`             | When                                 | What the SDK does next                                         |
| -------------------- | ------------------------------------ | -------------------------------------------------------------- |
| `selector.calculate` | Options or a toggle cannot be priced | Each option keeps its last price, else shows its package price |
