---
title: 'Page state'
group: 'Attribute Reference/Setup'
order: 102
---

# Page state

What the SDK sets on the page as it works, for CSS. Pages never write these.

```css
html:not([data-next-ready]) [data-next-query] {
  visibility: hidden;
}
[data-next-option][data-next-selected] {
  border-color: var(--brand);
}
```

| Attribute                                  | On                                                                                                   |
| ------------------------------------------ | ---------------------------------------------------------------------------------------------------- |
| `data-next-ready`                          | `<html>`, once every value on the page is written, after [sdk.ready](/event-reference/sdk/sdk.ready) |
| `data-next-error="config\|load\|campaign"` | `<html>`: no campaign key, the SDK could not load, or the campaign could not (and no copy was saved) |
| `data-next-selected`, `aria-pressed`       | the picked option, payment method or variant value                                                   |
| `data-next-in-cart`                        | an option whose lines are in the cart                                                                |
| `data-next-loading`, `aria-busy`           | an option being priced, an action running                                                            |
| `data-next-disabled`, `disabled`           | an action that cannot run, a variant value no package has                                            |
| `data-next-invalid`, `aria-invalid`        | a field with an error, an action that was refused                                                    |
| `hidden`                                   | an element a condition hides, a billing address while it is the shipping one                         |
| `data-next-empty`                          | a `data-next-each` with no items                                                                     |

The campaign saved in this browser from an earlier page counts: on a later page the values show
from that copy at once, and the API's answer replaces it when it arrives.

The 0.4.x classes and events stay: `html.next-display-ready`, `next:initialized`, and the classes
listed on [Legacy attributes](../legacy/legacy-attributes.md).

## Events

[sdk.ready](/event-reference/sdk/sdk.ready); a listener added later still receives it.
