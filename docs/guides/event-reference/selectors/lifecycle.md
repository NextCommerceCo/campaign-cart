---
title: 'Selector lifecycle'
group: 'Event Reference/Selectors'
---

# Selector lifecycle

![Selector lifecycle: picked, quoting, quoted and unquoted, with the events each step sends](selector-lifecycle.svg)

| State      | Means                                                        |
| ---------- | ------------------------------------------------------------ |
| `picked`   | The selector is registered and a card is picked              |
| `quoting`  | The cards with no quote yet are being priced                 |
| `quoted`   | Every card has a price                                       |
| `unquoted` | Quoting failed; the cards show the campaign's package prices |

| From                 | What happens                                                     | To         | Events                                                        |
| -------------------- | ---------------------------------------------------------------- | ---------- | ------------------------------------------------------------- |
| none                 | The selector is registered and its first card picked             | `picked`   | `selector.selected`                                           |
| `picked`             | Some cards have no quote from the last 10 minutes                | `quoting`  | `selector.calculating`                                        |
| `picked`             | Every card has a quote from the last 10 minutes                  | `quoted`   | `selector.calculated` (`from_cache: true`)                    |
| `quoting`            | The quotes arrive                                                | `quoted`   | `selector.calculated` (`from_cache: false`)                   |
| `quoting`            | Quoting fails                                                    | `unquoted` | `sdk.error` (`selector.quote`)                                |
| `quoted`             | Another card is picked                                           | `quoted`   | `selector.selected`                                           |
| `quoted`, `unquoted` | The picked card's quantity, a slot, or the cart's coupons change | `quoting`  | `selector.selected` (not for coupons), `selector.calculating` |

A toggle (a bump such as a warranty) sends `selector.selected` when it is switched on and
`selector.deselected` when it is switched off, with `type: 'toggle'`, and is priced the same way.

## Errors

Each sends `sdk.error` with this `action`. The SDK lifecycle lists every action and `code`.

| `action`         | When                                      | What the SDK does next                       |
| ---------------- | ----------------------------------------- | -------------------------------------------- |
| `selector.quote` | Bundle cards or a toggle cannot be quoted | The cards show the campaign's package prices |
