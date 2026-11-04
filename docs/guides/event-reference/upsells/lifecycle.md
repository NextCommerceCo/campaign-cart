---
title: 'Upsell lifecycle'
group: 'Event Reference/Upsells'
---

# Upsell lifecycle

![Upsell lifecycle: shown, adding, accepted, skipped and failed, with the events each step sends](upsell-lifecycle.svg)

| State      | Means                                                                                   |
| ---------- | --------------------------------------------------------------------------------------- |
| `shown`    | An offer is on the page                                                                 |
| `adding`   | The offer is being added to the order                                                   |
| `accepted` | The offer was added; the shopper is redirected to the next page                         |
| `skipped`  | The shopper went on without the offer                                                   |
| `failed`   | Adding the offer failed, such as a decline; the shopper is redirected on after a second |

| From     | What happens                                               | To         | Events, in order                                             |
| -------- | ---------------------------------------------------------- | ---------- | ------------------------------------------------------------ |
| none     | The upsell page loads the order and shows the offer        | `shown`    | `order.loaded`, `order.paid` the first time, `upsell.viewed` |
| `shown`  | The shopper accepts                                        | `adding`   | none                                                         |
| `shown`  | The shopper accepts an offer already accepted on that page | none       | none; redirected on                                          |
| `adding` | The offer is added                                         | `accepted` | `upsell.accepted` (with the updated `order`)                 |
| `adding` | Adding fails                                               | `failed`   | `sdk.error` (`upsell.add`), `upsell.failed`                  |
| `shown`  | The shopper skips it                                       | `skipped`  | `upsell.skipped`                                             |

The next page sends `order.loaded` with an accepted offer in `upsells`, once. An order that cannot
load, or does not take upsells, keeps the offer hidden and sends no `upsell.viewed`.

## Errors

Each sends `sdk.error` with this `action`. The SDK lifecycle lists every action and `code`.

| `action`     | When                      | What the SDK does next                                       |
| ------------ | ------------------------- | ------------------------------------------------------------ |
| `upsell.add` | The offer cannot be added | `upsell.failed`; the shopper is redirected on after a second |
