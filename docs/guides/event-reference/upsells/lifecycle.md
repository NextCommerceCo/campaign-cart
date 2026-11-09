---
title: 'Upsell lifecycle'
group: 'Event Reference/Upsells'
---

# Upsell lifecycle

Events: `upsell.*`, with `order.updated` after an accept and `payment.failed` for a decline.

![Upsell lifecycle: next-available, next-processing, next-success, next-error, next-skipped and next-hidden on one upsell page, with the events each step sends and the page it leaves for](upsell-lifecycle.svg)

The lifecycle is one [offer](../../attribute-reference/objects/selector.md)'s
on one page after the checkout, opened with the order's `ref_id`. Its state is the class on the
offer; while it is added, the order's `status` is `accepting`.

| State             | Means                                                                               |
| ----------------- | ----------------------------------------------------------------------------------- |
| `next-hidden`     | The order does not take upsells, or did not load: the offer stays hidden            |
| `next-available`  | The order takes upsells: the offer is shown                                         |
| `next-processing` | The offer is being added to the order                                               |
| `next-success`    | Added, or already added on this page; the next page opens after a tenth of a second |
| `next-error`      | Not added; the next page opens after a second                                       |
| `next-skipped`    | The shopper went on without it; the next page opens at once                         |

| From                            | What happens                                                                                          | To                | Events, in order                                                                          |
| ------------------------------- | ----------------------------------------------------------------------------------------------------- | ----------------- | ----------------------------------------------------------------------------------------- |
| none                            | The page loads the order, and it takes upsells                                                        | `next-available`  | `order.loaded`, then `order.paid` the first time this browser has it paid                 |
| none                            | The order does not take upsells, or cannot load                                                       | `next-hidden`     | `order.loaded`; or `sdk.error` (`order.load`) when it cannot load                         |
| `next-available`                | Half of the offer is on screen, and its selector, if any, is priced                                   | `next-available`  | `upsell.viewed`, once per offer                                                           |
| `next-available`                | The shopper accepts                                                                                   | `next-processing` | none; `upsell.viewed` first, if it has not come yet                                       |
| `next-processing`               | The order takes the offer                                                                             | `next-success`    | `upsell.accepted`, `order.updated`                                                        |
| `next-processing`               | No answer (`network`, `timeout` or `server`): the order is loaded again, and it has the offer's lines | `next-success`    | `upsell.accepted`, `order.updated`                                                        |
| `next-processing`               | No answer, and the order loaded again does not have them, or cannot load                              | `next-error`      | `sdk.error` (`upsell.add`), `upsell.failed` (with `error`)                                |
| `next-processing`               | Refused                                                                                               | `next-error`      | `sdk.error` (`upsell.add`), `upsell.failed` (with `error`)                                |
| `next-processing`               | Declined                                                                                              | `next-error`      | `upsell.declined`, `payment.failed` (`method`, `ref_id`, `error` with `code: 'declined'`) |
| `next-available`                | The shopper accepts, but an offer was already added on this page for this order                       | `next-success`    | none                                                                                      |
| `next-available`                | The shopper accepts, but the offer has nothing to add: no package id, nothing picked in its selector  | `next-error`      | none; a warning is logged                                                                 |
| `next-hidden`                   | The shopper accepts                                                                                   | `next-error`      | none                                                                                      |
| `next-available`, `next-hidden` | The shopper skips                                                                                     | `next-skipped`    | `upsell.skipped`; `upsell.viewed` first, if it has not come yet                           |

## Viewed once

- `upsell.viewed` comes once per offer: when half of it is on screen, after the order has loaded
  and the offer's selector, if any, is priced.
- An accept or a skip counts as a view: `upsell.viewed` comes first if it has not come yet, on a
  `next-hidden` offer too once the order has loaded.
- An offer the order cannot load sends no `upsell.viewed`, on screen or clicked.
- `upsell.shown`, internal, marks the offer shown; the 0.4.x `upsell:viewed` comes from it, before
  the offer is on screen.

## Added once

- One add per order and page: once an offer is added, an accept on that page, after a reload or a
  back included, goes to `next-success` without a second add.
- While the order loads, or another offer on the page is being added, an accept does nothing:
  `next-processing` comes off at once. A skip still goes on, with `upsell.skipped` once the URL has a
  `ref_id`.
- Once the offer is leaving, every further click does nothing.

## The next page

- The button's `data-next-url`, else `next-upsell-accept-url` after an accept or a failed add and
  `next-upsell-decline-url` after a skip; without one the shopper stays.
- The URL gets the order's `ref_id` and the visit's
  [URL parameters](../../attribute-reference/setup/url-parameters.md).
- `next-success` leaves after a tenth of a second, `next-skipped` at once, `next-error` after a
  second.
- The next page sends `order.loaded` with the order, its added lines marked `upsell: true`.

## Classes

- Before the order loads the offer has no class; `next-available` or `next-hidden` comes once it has
  loaded, or failed to.
- `next-success` is on for three seconds and `next-error` for five; `next-processing` stays on after
  a success.
- The buttons are `next-disabled` while any offer on the page is being added, or this one is leaving.

## What each event carries

- `upsell.*`: the same Upsell: the order's `ref_id`, the `page`, `selector_id` and `option_id` for an
  offer with a selector, its `lines` and `currency`, and `total` once the offer has a price.
- `upsell.failed` adds the `error`; `upsell.declined`, internal, the `error` and its `message`.
- `payment.failed`: the order's payment `method`, its `ref_id`, and the `error` with
  `code: 'declined'` and the gateway's `decline_code` when it gave one.
- `order.updated`: the Order with the added lines, marked `upsell: true`.

## Errors

Each sends `sdk.error` with this `action`. The SDK lifecycle lists every action and `code`.

| `action`     | When                                                                                         | What the SDK does next                                                                                                |
| ------------ | -------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| `upsell.add` | The offer cannot be added: refused, or no answer and the order loaded again does not have it | `upsell.failed`; `next-error`, and the next page after a second. A decline sends `payment.failed` without `sdk.error` |
| `order.load` | The page cannot load the order                                                               | The offer is `next-hidden`: no `upsell.viewed`; an accept goes to `next-error`, a skip to `next-skipped`              |
