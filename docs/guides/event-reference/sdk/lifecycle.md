---
title: 'SDK lifecycle'
group: 'Event Reference/SDK'
---

# SDK lifecycle

Events: `sdk.ready` and `sdk.error`.

![SDK lifecycle: starting, then ready or failed, with sdk.ready and sdk.error](sdk-lifecycle.svg)

The lifecycle is one page's: every page load starts at `starting`, and a page restored from the
back/forward cache reloads and starts again.

| State      | Means                                                                                                                         |
| ---------- | ----------------------------------------------------------------------------------------------------------------------------- |
| `starting` | The campaign is loading; `window.next` already exists                                                                         |
| `ready`    | The campaign is in; `html[data-next-ready]` is set once the page shows its values                                             |
| `failed`   | The campaign could not load, and this browser has no copy of it from the last 10 minutes; `html[data-next-ready]` never comes |

| From                  | What happens                                                        | To        | Events, in order                                                                                              |
| --------------------- | ------------------------------------------------------------------- | --------- | ------------------------------------------------------------------------------------------------------------- |
| none                  | The loader has no `data-campaign` key, or the SDK code cannot load  | none      | none: `html[data-next-error="config"]` or `"load"`, a `console.error`, and no `window.next`                   |
| `starting`            | A copy of the campaign saved in this browser in the last 10 minutes | `ready`   | `sdk.ready`, at once; when the API answers, the copy is replaced (no event of its own) and the cart is priced |
| `starting`            | No copy: the API answers                                            | `ready`   | `sdk.ready`                                                                                                   |
| `starting`            | No copy: the API fails                                              | `failed`  | `sdk.error` (`campaign.load`); no `sdk.ready` on this page                                                    |
| `starting` or `ready` | Browser storage is blocked or full                                  | unchanged | `sdk.error` (`storage.write`); before `window.next` exists it still reaches a listener added later            |
| `ready`               | The API fails after a saved copy made it ready                      | `ready`   | `sdk.error` (`campaign.load`); the copy stays in use and prices the cart                                      |
| `ready`               | A step fails; see Errors below                                      | `ready`   | `sdk.error`, then the step's own event when it has one                                                        |

## Snapshot

- `sdk.ready` carries a Snapshot: the `campaign`, the `cart` and the `selectors` as the page shows
  them then, the same objects the events carry.
- `checkout` joins once a checkout form is bound and `order` once a page loads one, both after
  `sdk.ready`: `next.snapshot()` has them, the event does not.
- `next.snapshot()` returns the same shape at any time.

## Late listeners

- `next.on` and `next.analytics.on` give a listener added later the events of that name this page
  already sent (its last 100; `sdk.ready` is never dropped), oldest first, then the new ones.
- Past 100, the oldest `cart.updated`, `cart.calculating`, `cart.calculated`, `selector.pricing`
  or `selector.priced` goes first, then the oldest internal event, then any other.
- A 0.4.x name gets only the events after the call; `campaign:loaded`, `currency:fallback`,
  `sdk:url-parameters-processed`, `error:occurred` and `checkout:started` are replayed too.

## `html` attributes

- `data-next-error`: `"config"` or `"load"` when the loader never started the SDK; `"campaign"`
  when `campaign.load` failed, with or without a saved copy.
- `data-next-ready` (empty): after `sdk.ready`, once the checkout, order and slot code the page uses
  has bound and the values are written.
- Then the `window.nextReady` callbacks run with `window.next` (a later push runs at once), and
  analytics starts when the browser is idle.
- In `failed` none of that happens: no `data-next-ready`, and the `nextReady` callbacks never run.

## Errors

- On `sdk.error`, `action` names the step, `code` says why, `status` is the HTTP status when the
  API answered, and `message` is for developers and logs, never for shoppers.
- A failure the shopper sees gets a second event: `checkout.failed` and `upsell.failed` carry it as
  `error`; `coupon.check`'s is followed by `coupon.denied` (`reason: 'check_failed'`).
- An order the API refuses by request field (HTTP 400 `{"lines": ["…"]}`) carries the API's text in
  `message`, on `sdk.error`, `checkout.failed` and in the log:
  `POST /api/v1/orders/ → 400: lines: Don't have enough stock…`. Payment fields are left out. The
  shopper reads `order.errors.<field>` instead ([Language](../../attribute-reference/setup/language.md)).
- A payment not taken is no SDK failure: a decline, or a return from the gateway unpaid, sends only
  `payment.failed`, `code: 'declined'` (and the gateway's `decline_code`) or `'payment_failed'`.
- The 0.4.x `error:occurred` gets every `sdk.error`, as `message`, `code` and `details`.

| `action`             | When                                                    | What the SDK does next                                                                                                                             | Also sent                          | Likely `code`                              |
| -------------------- | ------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------- | ------------------------------------------ |
| `campaign.load`      | The campaign cannot load                                | Stops at `failed`, without `sdk.ready`, when there is no saved copy; otherwise stays `ready` on the copy                                           | `html[data-next-error="campaign"]` | `network`, `auth`, `server`, `rejected`    |
| `cart.calculate`     | The cart cannot be priced                               | The cart is unpriced: the summary keeps its totals from before the change; the next change prices again                                            | none                               | `network`, `server`, `rejected`            |
| `selector.price`     | Options or a toggle cannot be priced                    | Each option keeps its last price, else shows its package price; the next change prices again                                                       | none                               | `network`, `server`                        |
| `coupon.check`       | A coupon cannot be checked                              | The code is not applied; `applyCoupon` resolves `false`                                                                                            | `coupon.denied` (`check_failed`)   | `network`, `server`                        |
| `user.save`          | The Open Cart cannot be created                         | Tries again on the next field change                                                                                                               | none                               | `network`, `server`, `rejected`            |
| `address.load_rules` | The country list or a country's rules cannot load       | Uses the campaign's countries and the built-in checks                                                                                              | none                               | `network`, `server`                        |
| `address.suggest`    | Address suggestions cannot load                         | Shows no suggestions                                                                                                                               | none                               | `network`, `server`                        |
| `order.create`       | The order is not created: refused, or the request fails | The checkout goes back to `idle`; the cart unfreezes                                                                                               | `checkout.failed`                  | `rejected`, `network`, `server`            |
| `order.load`         | A page after the checkout cannot load the order in 10 s | No `order.loaded` or `order.paid`: no order values, `data-next-order-items` shows its error message, and offers stay hidden                        | none                               | `network`, `timeout`, `server`             |
| `upsell.add`         | The offer cannot be added                               | On `network`, `timeout` or `server` it loads the order again first: an upsell that got on it counts as accepted. Else the next page after a second | `upsell.failed`                    | `rejected`, `network`, `timeout`, `server` |
| `storage.write`      | Browser storage is blocked or full                      | Keeps working from memory; the cart may not carry over to the next page                                                                            | none                               | `unavailable`                              |

| `code`              | Means                                                              |
| ------------------- | ------------------------------------------------------------------ |
| `network`           | No answer: offline, DNS, CORS, or blocked                          |
| `timeout`           | The SDK stopped waiting, such as the 10-second order load          |
| `server`            | The API failed (HTTP 5xx)                                          |
| `rejected`          | The API refused the request (any other HTTP 4xx)                   |
| `declined`          | The card or the payment gateway declined; only on `payment.failed` |
| `payment_failed`    | The gateway sent the shopper back unpaid; only on `payment.failed` |
| `auth`              | The campaign key is not allowed (HTTP 401, 403)                    |
| `too_many_requests` | Rate limited (HTTP 429)                                            |
| `unavailable`       | Browser storage is blocked or full                                 |
