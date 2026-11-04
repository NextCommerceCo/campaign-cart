---
title: 'Selector lifecycle'
group: 'Event Reference/Selectors'
---

# Selector lifecycle

![Selector lifecycle: picked, calculating, priced and unpriced, with the events each step sends](selector-lifecycle.svg)

An option is a card in a selector (`data-next-bundle-card`); `option_id` is its `data-next-bundle-id`.

| State         | Means                                                          |
| ------------- | -------------------------------------------------------------- |
| `picked`      | The selector is registered and an option is picked             |
| `calculating` | The options with no price yet are being priced                 |
| `priced`      | Every option has a price                                       |
| `unpriced`    | Pricing failed; the options show the campaign's package prices |

| From                 | What happens                                                       | To            | Events                                                        |
| -------------------- | ------------------------------------------------------------------ | ------------- | ------------------------------------------------------------- |
| none                 | The selector is registered and its first option picked             | `picked`      | `selector.selected`                                           |
| `picked`             | Some options have no price from the last 10 minutes                | `calculating` | `selector.calculating`                                        |
| `picked`             | Every option has a price from the last 10 minutes                  | `priced`      | `selector.calculated`                                         |
| `calculating`        | The prices arrive                                                  | `priced`      | `selector.calculated`                                         |
| `calculating`        | Pricing fails                                                      | `unpriced`    | `sdk.error` (`selector.calculate`)                            |
| `priced`             | Another option is picked                                           | `priced`      | `selector.selected`                                           |
| `priced`, `unpriced` | The picked option's quantity, a slot, or the cart's coupons change | `calculating` | `selector.selected` (not for coupons), `selector.calculating` |

Every selector event carries the same `Selector`: the picked option and its lines, with the
product as in the cart, priced once the option has a price. The price that is paid comes with the
cart on `cart.*`.

A toggle (a bump such as a warranty) sends `selector.selected` when it is switched on and
`selector.deselected` when it is switched off, with `type: 'toggle'`, and is priced the same way.

## Errors

Each sends `sdk.error` with this `action`. The SDK lifecycle lists every action and `code`.

| `action`             | When                                 | What the SDK does next                         |
| -------------------- | ------------------------------------ | ---------------------------------------------- |
| `selector.calculate` | Options or a toggle cannot be priced | The options show the campaign's package prices |
