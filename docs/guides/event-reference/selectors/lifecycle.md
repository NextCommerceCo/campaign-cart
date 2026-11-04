---
title: 'Selector lifecycle'
group: 'Event Reference/Selectors'
---

# Selector lifecycle

![Selector lifecycle: picked, calculating, priced and unpriced, with the events each step sends](selector-lifecycle.svg)

An option is a card in a selector (`data-next-bundle-card`); `option_id` is its `data-next-bundle-id`.

| State         | Means                                                                          |
| ------------- | ------------------------------------------------------------------------------ |
| `picked`      | The selector is registered and an option is picked                             |
| `calculating` | The options with no price from the last 10 minutes are being priced            |
| `priced`      | Every option has a price                                                       |
| `unpriced`    | Pricing failed; each option keeps its last price, else shows its package price |

| From                                | What happens                                                                                               | To                                                                    | Events, in order                                                          |
| ----------------------------------- | ---------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| none                                | The selector picks its option: `?forceBundleId`, the one in the cart, `data-next-selected`, else the first | `picked`                                                              | `selector.selected`                                                       |
| `picked`                            | Some options have no price from the last 10 minutes                                                        | `calculating`                                                         | `selector.calculating`                                                    |
| `picked`                            | Every option has a price from the last 10 minutes                                                          | `priced`                                                              | `selector.calculated`                                                     |
| `calculating`                       | The prices arrive                                                                                          | `priced`                                                              | `selector.calculated`                                                     |
| `calculating`                       | Pricing fails                                                                                              | `unpriced`                                                            | `sdk.error` (`selector.calculate`)                                        |
| any                                 | Another option is picked                                                                                   | same state                                                            | `selector.selected`                                                       |
| `calculating`, `priced`, `unpriced` | The picked option's quantity or a slot changes                                                             | `calculating`, or `priced` if every price is from the last 10 minutes | `selector.selected`, then `selector.calculating` or `selector.calculated` |
| `calculating`, `priced`, `unpriced` | The cart's coupons change                                                                                  | as above                                                              | `selector.calculating` or `selector.calculated`                           |

In swap mode, the default, picking also puts the option in the cart, so `cart.updated` follows.

Every selector event carries the same `Selector`: the picked option and its lines, with the
product as in the cart, priced once the option has a price. The price that is paid comes with the
cart on `cart.*`.

A toggle (a bump such as a warranty) sends `selector.selected` when it is switched on and
`selector.deselected` when it is switched off from its card, with `type: 'toggle'`. While it is off
it is priced as if added (`selector.calculating`, `selector.calculated` with its line), again on
every cart change; once on, its price comes with the cart on `cart.*`. Removing its line in the
cart, or clearing the cart, sends no `selector.deselected`.

## Errors

Each sends `sdk.error` with this `action`. The SDK lifecycle lists every action and `code`.

| `action`             | When                                 | What the SDK does next                                         |
| -------------------- | ------------------------------------ | -------------------------------------------------------------- |
| `selector.calculate` | Options or a toggle cannot be priced | Each option keeps its last price, else shows its package price |
