---
title: 'Upsell lifecycle'
group: 'Event Reference/Upsells'
---

# Upsell lifecycle

Events: `upsell.*`, with `order.updated` after an accept and `payment.failed` for a decline.

![Upsell lifecycle: shown, adding, accepted, skipped and failed, with the events each step sends](upsell-lifecycle.svg)

| State      | Means                                                                                                                 |
| ---------- | --------------------------------------------------------------------------------------------------------------------- |
| `shown`    | An offer is on the page                                                                                               |
| `adding`   | The offer is being added to the order                                                                                 |
| `accepted` | The offer was added; the shopper is redirected to the next page                                                       |
| `skipped`  | The shopper went on without the offer; redirected to the next page                                                    |
| `failed`   | Adding the offer failed: declined, refused, or the order does not have it; redirected to the next page after a second |

| From     | What happens                                                                                                | To         | Events, in order                                                        |
| -------- | ----------------------------------------------------------------------------------------------------------- | ---------- | ----------------------------------------------------------------------- |
| none     | The page loads the order, the order takes upsells, and the offer's selector, if any, is not being priced    | `shown`    | `order.loaded`, and `order.paid` the first time after a gateway         |
| `shown`  | Half of the offer comes on screen                                                                           | `shown`    | `upsell.viewed`, once per offer                                         |
| `shown`  | The shopper accepts                                                                                         | `adding`   | none                                                                    |
| `adding` | The order takes the offer                                                                                   | `accepted` | `upsell.accepted`, `order.updated`                                      |
| `adding` | Declined                                                                                                    | `failed`   | `payment.failed` (`ref_id`, `error` with `code: 'declined'`)            |
| `adding` | Refused                                                                                                     | `failed`   | `sdk.error` (`upsell.add`), `upsell.failed` (with `error`)              |
| `adding` | No answer (a network failure, a timeout or a server error): the order is loaded again, and it has the offer | `accepted` | `upsell.accepted`, `order.updated`                                      |
| `adding` | No answer, and the order loaded again does not have the offer, or cannot load                               | `failed`   | `sdk.error` (`upsell.add`), `upsell.failed`                             |
| `shown`  | The shopper skips it                                                                                        | `skipped`  | `upsell.skipped`                                                        |
| `shown`  | The shopper accepts an offer already accepted on that page                                                  | none       | none; redirected to the next page                                       |
| `shown`  | The offer has nothing to add: no package id, nothing picked in its selector                                 | none       | none; a warning is logged, and the shopper is redirected after a second |

The next page is the button's `data-next-url`, else `next-upsell-accept-url` after an accept or a
failed add and `next-upsell-decline-url` after a skip, with the order's `ref_id` added; without one
the shopper stays. Accepted, the shopper leaves after a tenth of a second; skipped, at once;
failed, after a second. The next page sends `order.loaded`, with an accepted offer's lines marked
`upsell: true`.

`upsell.viewed` comes when half of the offer is on screen, once its selector, if it has one, is no
longer being priced. An
order that cannot load, or does not take upsells, keeps the offer hidden and sends no
`upsell.viewed`. While the order loads or an offer is being added, another accept does nothing.

Every upsell event carries the same `Upsell`: the order's `ref_id`, the page, the offer's selector
and picked option when it has one, and its lines, priced once the offer has a price.

## Errors

Each sends `sdk.error` with this `action`. The SDK lifecycle lists every action and `code`.

| `action`     | When                                                                            | What the SDK does next                                                                                            |
| ------------ | ------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| `upsell.add` | The offer cannot be added: refused, or no answer and the order does not have it | `upsell.failed`; redirected to the next page after a second. A decline sends `payment.failed` without `sdk.error` |
