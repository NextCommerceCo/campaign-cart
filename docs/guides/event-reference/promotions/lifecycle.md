---
title: 'Promotion lifecycle'
group: 'Event Reference/Promotions'
---

# Promotion lifecycle

Events: `promotion.*`.

A promotion is the exit-intent popup (`type: 'exit_intent'`) or an element the page marks with
`data-next-promotion` (`type: 'banner'`). The debug panel notes each `promotion.viewed`.

## Exit-intent popup

![Exit-intent popup lifecycle: waiting, open and closed, with promotion.viewed, promotion.clicked and promotion.closed](promotion-lifecycle.svg)

The lifecycle is one popup's, made by `next.exitIntent(options)`. It starts at `waiting` and opens
up to `maxTriggers` times a tab session, 1 by default.

| State     | Means                                                                                 |
| --------- | ------------------------------------------------------------------------------------- |
| `waiting` | The popup is off the page, and opens on its trigger                                   |
| `open`    | The overlay and the popup are on the page                                             |
| `closed`  | The popup is off the page after a view; it opens again only while under `maxTriggers` |

| From              | What happens                                                                                 | To                 | Events, in order                                                                                                                        |
| ----------------- | -------------------------------------------------------------------------------------------- | ------------------ | --------------------------------------------------------------------------------------------------------------------------------------- |
| none              | The page calls `next.exitIntent({ image })` or `({ template })`                              | `waiting`          | none                                                                                                                                    |
| `waiting`         | Desktop: the mouse leaves through the top of the window. Touch screen: a scroll back up      | `open`             | `promotion.viewed`                                                                                                                      |
| `open`            | The image (`imageClickable`, on by default) or a `data-exit-intent-action` button is clicked | `closed`           | `promotion.clicked` (with `action` and `coupon_code` for a button), then its action runs, then `promotion.closed` (`reason: 'clicked'`) |
| `open`            | Esc, or the overlay (`overlayClosable`, on by default)                                       | `closed`           | `promotion.closed` (`reason: 'dismissed'`)                                                                                              |
| `open`            | The × button (`showCloseButton`, off by default)                                             | `closed`           | `promotion.closed` (`reason: 'close_button'`)                                                                                           |
| `waiting`, `open` | The page calls the function `next.exitIntent()` resolved to                                  | `closed`, for good | none                                                                                                                                    |
| `closed`          | It has opened fewer than `maxTriggers` times this tab session                                | `waiting`          | none                                                                                                                                    |

### Triggers

- Desktop: `mouseout` at `clientY <= 0` with no `relatedTarget`, the mouse leaving through the top
  of the window.
- Touch screen (`pointer: coarse`): a scroll past 30% of the window's height, then back up by more
  than 100px.
- A touch screen waits only with `mobileScrollTrigger: true` or `disableOnMobile: false`;
  `disableOnMobile` is on by default.
- A `template` not on the page shows `image` instead; without that, or without either option, it
  warns and never opens.

### `maxTriggers`

- The count is `visit.exitIntentShown`, in `sessionStorage`: it survives a reload or a step and
  resets in a new tab.
- One count for the whole tab session, shared by every `next.exitIntent()` call.
- It counts an open, so a popup the page removes still counts.

### Clicks

- `promotion.clicked` comes once per open, before the action runs; clicks while it runs are
  ignored.
- An `apply-coupon` button applies its `data-coupon-code` without waiting for it: its coupon events
  (see the coupon lifecycle) can come after `promotion.closed`.
- The image's action and a `custom` button's `exitIntent({ action })` are waited for; one that
  throws is logged, and the popup still closes as `clicked`.
- A `close` button closes as `clicked`, like any button; `close_button` is the × only.

### Closing

- `promotion.closed` comes once for each `promotion.viewed`, unless the page removes the popup.
- The function `next.exitIntent()` resolves to removes the popup without `promotion.closed` and
  stops it opening again.
- Esc closes with `reason: 'dismissed'` whatever `overlayClosable` says.

## Banner

![Banner lifecycle: on the page, then viewed, with promotion.viewed and promotion.clicked](banner-lifecycle.svg)

The lifecycle is one element's: each `data-next-promotion` element has its own, from when the SDK
binds it, at load or by `next.bind(root)` for one added later.

| State         | Means                                                       |
| ------------- | ----------------------------------------------------------- |
| `on the page` | The element is bound; less than half of it has been in view |
| `viewed`      | Half of it has been in view                                 |

| From                    | What happens                                                       | To            | Events, in order                                   |
| ----------------------- | ------------------------------------------------------------------ | ------------- | -------------------------------------------------- |
| none                    | The SDK binds an element with `data-next-promotion="<id>"`         | `on the page` | none; an empty id skips the element with a warning |
| `on the page`           | Half of it comes into view (`IntersectionObserver`, threshold 0.5) | `viewed`      | `promotion.viewed`, once per element               |
| `on the page`, `viewed` | It is clicked                                                      | same state    | `promotion.clicked`, on every click                |

### Viewing

- `promotion.viewed` comes once per element, however often the page is bound: the observer stops
  after it.
- Where the browser has no `IntersectionObserver`, `promotion.viewed` comes when the element is
  bound.
- A banner never sends `promotion.closed`.

## What each event carries

- Every event: the `Promotion`, its `id`, `type`, and `name` and `creative` when set.
- The popup's `id` is `exitIntent({ id })`, else `exit_intent`; `name` is `exitIntent({ name })`;
  `creative` the template's name, or the image URL.
- A banner's `id` is its `data-next-promotion`, `name` its `data-next-promotion-name` and
  `creative` its `data-next-promotion-creative`.
- `promotion.clicked` adds a button's `action` and `coupon_code`; `promotion.closed` its `reason`.

## Errors

A promotion calls no API and sends no `sdk.error` of its own. An `apply-coupon` button's code
follows the coupon lifecycle; an action that throws is logged.

| `action`       | When                                              | What the SDK does next                                                      |
| -------------- | ------------------------------------------------- | --------------------------------------------------------------------------- |
| `coupon.check` | An `apply-coupon` button's code cannot be checked | `coupon.denied` with `reason: 'check_failed'`; the popup has already closed |
