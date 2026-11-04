---
title: 'SDK lifecycle'
group: 'Event Reference/SDK'
---

# SDK lifecycle

![SDK lifecycle: starting, ready and failed, with the events each step sends](sdk-lifecycle.svg)

| State      | Means                                                                                    |
| ---------- | ---------------------------------------------------------------------------------------- |
| `starting` | The SDK is loading the campaign                                                          |
| `ready`    | The campaign is in; `html[data-next-ready]` is set once the page shows its values        |
| `failed`   | The campaign could not load, and this browser has no copy of it from the last 10 minutes |

| From       | What happens                                                                            | To       | Events, in order                                                         |
| ---------- | --------------------------------------------------------------------------------------- | -------- | ------------------------------------------------------------------------ |
| none       | The loader has no `data-campaign` key, or the SDK code cannot load                      | none     | none: `html[data-next-error="config"]` or `"load"`, and no `window.next` |
| `starting` | A copy of the campaign saved in this browser in the last 10 minutes, or the API answers | `ready`  | `sdk.ready`, once a page                                                 |
| `starting` | The API fails and there is no saved copy                                                | `failed` | `sdk.error` (`campaign.load`); no `sdk.ready`                            |
| `ready`    | The API fails after a saved copy made it ready                                          | `ready`  | `sdk.error` (`campaign.load`)                                            |
| `ready`    | A step fails; see Errors below                                                          | `ready`  | `sdk.error`                                                              |

`sdk.ready` carries a Snapshot: the campaign, the cart, the checkout, the order and the selectors
as the page shows them then, the same objects the events carry. `next.snapshot()` returns the same
at any time. A failed campaign load also sets `html[data-next-error="campaign"]`.

`next.on` gives a listener added later the page's earlier events of that name first, then the new
ones. The page keeps its last 100 events for this, dropping the oldest cart and selector updates
first; `sdk.ready` is always kept. A 0.4.x name gets only the events after the call, except those
0.4.x pages listen for late (`campaign:loaded`, `checkout:started`, …).

## Errors

Every failure sends `sdk.error`: `action` names the step, `code` says why, `status` is the HTTP
status when the API answered, `decline_code` is the gateway's code for a declined card, and
`message` is for developers and logs, never for shoppers. `checkout.failed` and `upsell.failed`
follow their `sdk.error` with the failure as `error`, and `coupon.denied` follows `coupon.check`'s
with `reason: 'check_failed'`. A payment the gateway did not take sends `payment.failed` alone, with
`code: 'payment_failed'`, because the SDK did not fail.

| `action`             | When                                                              | What the SDK does next                                                                       | Also sent                                                   | Likely `code`                               |
| -------------------- | ----------------------------------------------------------------- | -------------------------------------------------------------------------------------------- | ----------------------------------------------------------- | ------------------------------------------- |
| `campaign.load`      | The campaign cannot load                                          | Stops at `failed`, without `sdk.ready`, when there is no saved copy; otherwise stays `ready` | `html[data-next-error="campaign"]`                          | `network`, `auth`, `server`                 |
| `cart.calculate`     | The cart cannot be priced                                         | The cart is `unpriced`; the summary keeps its totals from before the change                  | `shipping.selected` without prices, when the method changed | `network`, `server`, `rejected`             |
| `selector.calculate` | Options or a toggle cannot be priced                              | Each option keeps its last price, else shows its package price                               | none                                                        | `network`, `server`                         |
| `coupon.check`       | A coupon cannot be checked                                        | The code is not applied; `applyCoupon` resolves `false`                                      | `coupon.denied` (`check_failed`)                            | `network`, `server`                         |
| `user.save`          | The Open Cart cannot be created                                   | Tries again on the next field change                                                         | none                                                        | `network`, `server`, `rejected`             |
| `address.load_rules` | The country list or a country's rules cannot load                 | Uses the campaign's countries and simpler checks                                             | none                                                        | `network`, `server`                         |
| `address.suggest`    | Address suggestions cannot load                                   | Shows no suggestions                                                                         | none                                                        | `network`, `server`                         |
| `order.create`       | The order is not created: refused, declined, or the request fails | Back to filling; the cart unfreezes                                                          | `checkout.failed`                                           | `declined`, `rejected`, `network`, `server` |
| `order.load`         | A page after the checkout cannot load the order                   | No `order.loaded` or `order.paid`; the page shows no order values and offers stay hidden     | none                                                        | `network`, `timeout`, `server`              |
| `upsell.add`         | The offer cannot be added                                         | Redirected to the next page after a second                                                   | `upsell.failed`                                             | `declined`, `rejected`, `network`           |
| `storage.write`      | Storage is blocked or full                                        | Works on without saving the cart across pages                                                | none                                                        | `unavailable`                               |

| `code`              | Means                                                              |
| ------------------- | ------------------------------------------------------------------ |
| `network`           | No answer: offline, DNS, CORS, or blocked                          |
| `timeout`           | The SDK stopped waiting, such as the 10-second order load          |
| `server`            | The API failed (HTTP 5xx)                                          |
| `rejected`          | The API refused the request (HTTP 4xx)                             |
| `declined`          | The card or the payment gateway declined                           |
| `payment_failed`    | The gateway sent the shopper back unpaid; only on `payment.failed` |
| `auth`              | The campaign key is not allowed (HTTP 401, 403)                    |
| `too_many_requests` | Rate limited (HTTP 429)                                            |
| `unavailable`       | Browser storage is blocked or full                                 |
