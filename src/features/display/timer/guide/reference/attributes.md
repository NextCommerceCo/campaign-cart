---
title: "Features/Display/Timer/Attributes"
group: "Features"
category: "Timer"
---

# Attributes

<!-- Generated from the feature manifest. Do not edit by hand:
     edit <feature>.manifest.ts, then run `npm run docs:reference`. -->

Counts down to a deadline and survives a page reload, so an offer window stays honest.

Turned on by `[data-next-timer]` — and equally by `[data-next-timer-display]`, `[data-next-timer-expired]`.

## `data-next-timer`

| | |
|---|---|
| Type | `boolean (presence)` |
| Required | yes |
| Default | — |

Marks the element as a countdown timer.

---

## `data-duration`

| | |
|---|---|
| Type | `number (seconds)` |
| Required | yes |
| Default | — |

How long the countdown runs, in seconds. Counted from the moment the visitor first saw this timer, not from each page load.

> **Watch out:** Missing or non-numeric, the feature throws during init and the timer never starts.

---

## `data-persistence-id`

| | |
|---|---|
| Type | `string` |
| Required | no |
| Default | `default-timer` |

The key this timer's start time is stored under in `localStorage`. Because the start time persists, reloading the page does not restart the countdown — which is what stops a deadline from being infinitely renewable.

> **Watch out:** Two timers sharing an id share one deadline. Give every distinct offer its own id, or a second timer will silently inherit the first's remaining time.

---

## `data-format`

| | |
|---|---|
| Type | `string` |
| Required | no |
| Default | `mm:ss` |

How the remaining time is rendered — for example `mm:ss` for `04:31`, or a format including hours for a longer window.

## Read from other elements

These are not placed on the element this feature is bound to — look for them on inputs elsewhere in the page, or on a linked selector.

| Name | Values | Meaning |
|---|---|---|
| `data-next-timer-display` | — | Put on an element inside the timer to receive the formatted time. Without one, the timer element's own text is replaced. |
| `data-next-timer-expired` | — | Put on an element **anywhere** in the page, carrying the same `data-persistence-id` as the timer. It is revealed when that timer reaches zero — use it for the "offer expired" state. |

## Example

```html
<div data-next-timer data-duration="600" data-persistence-id="flash-sale" data-format="mm:ss">
  Offer ends in <span data-next-timer-display></span>
</div>

<!-- Revealed when the flash-sale timer hits zero; can sit anywhere -->
<div data-next-timer-expired data-persistence-id="flash-sale" hidden>
  This offer has expired.
</div>
```

The countdown resumes across reloads because the start time lives in
`localStorage` under `next-timer-flash-sale`. Clearing site data resets it.
