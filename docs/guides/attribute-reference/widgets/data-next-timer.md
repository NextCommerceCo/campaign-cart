---
title: 'data-next-timer'
group: 'Attribute Reference/Widgets'
order: 901
---

# data-next-timer

A countdown. It carries on from where it was when the shopper comes back in the same tab, then
hides itself and shows the elements marked as its expired state.

```html
<div data-next-timer data-duration="600" data-persistence-id="offer" data-format="mm:ss">
  Offer ends in <span data-next-timer-display>10:00</span>
</div>
<div data-next-timer-expired data-persistence-id="offer" style="display: none">The offer has ended</div>
```

## Attributes

| Attribute                 | Means                                                                                                                                                                                         |
| ------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `data-duration`           | Length in seconds. Required: a timer without it logs a warning                                                                                                                                |
| `data-persistence-id`     | Names the countdown. Timers with the same id, on any page of the tab, count down together. Default `default-timer`                                                                            |
| `data-format`             | `mm:ss` (default), `hh:mm:ss` or `ss`                                                                                                                                                         |
| `data-next-timer-display` | Inside the timer: where the time is written. Without it, the timer's own text is replaced                                                                                                     |
| `data-next-timer-expired` | With the same `data-persistence-id`: shown when the time is up. Hide it with an inline `style="display: none"`; the SDK clears the inline `display`, and does not remove a `hidden` attribute |

Once a countdown has run out, the next page that shows it starts it again from the full duration.

## Set by the SDK

| On                         | When           |
| -------------------------- | -------------- |
| The timer: `display: none` | The time is up |

## 0.4.x

`next.on('timer:expired', fn)` still fires, with `{ persistenceId }`.
