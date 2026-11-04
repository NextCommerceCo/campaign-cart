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

| From       | What happens                                                                            | To       | Events                                                                   |
| ---------- | --------------------------------------------------------------------------------------- | -------- | ------------------------------------------------------------------------ |
| none       | The loader has no `data-campaign` key, or the SDK code cannot load                      | none     | none: `html[data-next-error="config"]` or `"load"`, and no `window.next` |
| `starting` | A copy of the campaign saved in this browser in the last 10 minutes, or the API answers | `ready`  | `sdk.ready`, once a page; late listeners get it too                      |
| `starting` | The API fails and there is no saved copy                                                | `failed` | `sdk.error` (`campaign.load`); no `sdk.ready`                            |
| `ready`    | The API fails after a saved copy made it ready                                          | `ready`  | `sdk.error` (`campaign.load`)                                            |
| `ready`    | A step fails; see Errors below                                                          | `ready`  | `sdk.error`                                                              |

`sdk.error` is not replayed to listeners added later; a failed campaign load also sets
`html[data-next-error="campaign"]`, which a page can read at any time.

## Errors

Every failure sends `sdk.error`: `action` names the step, `code` says why, `status` is the HTTP
status when the API answered, and `message` is for developers and logs, never for shoppers.
`order.failed` and `upsell.failed` follow their `sdk.error` with what the page shows the shopper; a
payment that failed at a gateway sends `order.failed` alone, because the SDK did not fail.

| `action`               | When                                                              | What the SDK does next                                                                       | Also sent                                   | Likely `code`                               |
| ---------------------- | ----------------------------------------------------------------- | -------------------------------------------------------------------------------------------- | ------------------------------------------- | ------------------------------------------- |
| `campaign.load`        | The campaign cannot load                                          | Stops at `failed`, without `sdk.ready`, when there is no saved copy; otherwise stays `ready` | `html[data-next-error="campaign"]`          | `network`, `auth`, `server`                 |
| `cart.calculate`       | The cart cannot be priced                                         | The cart is `unpriced`; the summary keeps its totals from before the change                  | `cart.added`, `cart.removed` without prices | `network`, `server`, `rejected`             |
| `selector.calculate`   | Options or a toggle cannot be priced                              | Each option keeps its last price, else shows its package price                               | none                                        | `network`, `server`                         |
| `coupon.check`         | A coupon cannot be checked                                        | The code is not applied; `applyCoupon` resolves `false`                                      | none                                        | `network`, `server`                         |
| `user.save`            | The Open Cart cannot be created                                   | Tries again on the next field change                                                         | none                                        | `network`, `server`, `rejected`             |
| `address.rules`        | The country list or a country's rules cannot load                 | Uses the campaign's countries and simpler checks                                             | none                                        | `network`, `server`                         |
| `address.autocomplete` | Address suggestions cannot load                                   | Shows no suggestions                                                                         | none                                        | `network`, `server`                         |
| `order.create`         | The order is not created: refused, declined, or the request fails | Back to filling; the cart unfreezes                                                          | `order.failed` (`stage: 'order'`)           | `declined`, `rejected`, `network`, `server` |
| `order.load`           | A page after the checkout cannot load the order                   | The page shows no order values; offers stay hidden                                           | none                                        | `network`, `timeout`, `server`              |
| `upsell.add`           | The offer cannot be added                                         | The shopper is redirected on after a second                                                  | `upsell.failed`                             | `declined`, `rejected`, `network`           |
| `storage.write`        | Storage is blocked or full                                        | Works on without saving the cart across pages                                                | none                                        | `unavailable`                               |

| `code`              | Means                                                     |
| ------------------- | --------------------------------------------------------- |
| `network`           | No answer: offline, DNS, CORS, or blocked                 |
| `timeout`           | The SDK stopped waiting, such as the 10-second order load |
| `server`            | The API failed (HTTP 5xx)                                 |
| `rejected`          | The API refused the request (HTTP 4xx)                    |
| `declined`          | The payment gateway declined                              |
| `auth`              | The campaign key is not allowed (HTTP 401, 403)           |
| `too_many_requests` | Rate limited (HTTP 429)                                   |
| `unavailable`       | Browser storage is blocked or full                        |
