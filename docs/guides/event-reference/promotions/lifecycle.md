---
title: 'Promotion lifecycle'
group: 'Event Reference/Promotions'
---

# Promotion lifecycle

![Promotion lifecycle: waiting, open, clicked and closed, with the events each step sends](promotion-lifecycle.svg)

| State     | Means                                                         |
| --------- | ------------------------------------------------------------- |
| `waiting` | The exit-intent popup waits for the shopper to leave          |
| `open`    | The popup is on the page                                      |
| `clicked` | The shopper clicked its image or a template button; it closes |
| `closed`  | The shopper closed it without a click                         |

| From                | What happens                                                                          | To        | Events                                                     |
| ------------------- | ------------------------------------------------------------------------------------- | --------- | ---------------------------------------------------------- |
| `waiting`           | The mouse leaves the page, or on a phone with `mobileScrollTrigger`, a scroll back up | `open`    | `promotion.viewed`                                         |
| `open`              | The image or a template button is clicked                                             | `clicked` | `promotion.clicked` (`action`, `coupon_code` for a button) |
| `open`              | Esc or the overlay                                                                    | `closed`  | `promotion.closed` (`reason: 'dismissed'`)                 |
| `open`              | The close button                                                                      | `closed`  | `promotion.closed` (`reason: 'closed'`)                    |
| `clicked`, `closed` | The shopper leaves again, while under `maxTriggers` for the session                   | `open`    | `promotion.viewed`                                         |
