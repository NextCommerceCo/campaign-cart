---
title: 'data-next-ready'
group: 'Attribute Reference/Setup'
order: 102
---

# data-next-ready

Set by the SDK on `<html>` once every value on the page has been written: the campaign is in and
the checkout, order and slot code the page uses has bound. Use it to hide placeholders until then.

```css
html:not([data-next-ready]) [data-next-display] {
  visibility: hidden;
}
```

## Set by the SDK

| On       | Set                                                                                                       |
| -------- | --------------------------------------------------------------------------------------------------------- |
| `<html>` | `data-next-ready` (empty value), after [sdk.ready](/event-reference/sdk/sdk.ready)                        |
| `<html>` | `data-next-error="campaign"` instead, when the campaign could not be loaded and no copy was saved earlier |

The campaign saved in this browser from an earlier page counts: on a later page the values show
from that copy at once, and the API's answer replaces it when it arrives.

`[data-next-display]` elements are written before the campaign arrives too: a money or text value
that is not known yet is written as empty, and an element whose path is a yes/no value is hidden.

## 0.4.x

| 0.4.x                                                                         | Now                                                              |
| ----------------------------------------------------------------------------- | ---------------------------------------------------------------- |
| `html.next-display-ready` class                                               | Still set, at the same moment                                    |
| `document` event `next:initialized`                                           | Still sent. Use `window.nextReady` or `next.on('sdk.ready', fn)` |
| `[data-next-skeleton]` (faded out by the stylesheet on `.next-display-ready`) | Still works                                                      |

## Events

[sdk.ready](/event-reference/sdk/sdk.ready); a listener added later still receives it.
