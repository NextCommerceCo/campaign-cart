---
title: 'data-next-tooltip'
group: 'Attribute Reference/Widgets'
order: 903
---

# data-next-tooltip

A tooltip shown on hover, focus or tap, above the element (below when there is no room above).

```html
<button type="button" data-next-tooltip="We never share your email">Why?</button>
```

## Attributes

| Attribute                     | Means                                                         |
| ----------------------------- | ------------------------------------------------------------- |
| `data-next-tooltip`           | The text shown                                                |
| `data-next-tooltip-delay`     | Milliseconds before it shows on hover or focus. Default `500` |
| `data-next-tooltip-offset`    | Pixels between the element and the tooltip. Default `8`       |
| `data-next-tooltip-class`     | Extra classes on the tooltip                                  |
| `data-next-tooltip-max-width` | A CSS width for its content. Default `200px`                  |

A tap toggles it; Escape hides it.

## Set by the SDK

The tooltip is a `div.next-tooltip[role="tooltip"]` added to `body`, with `.next-tooltip__content`
and `.next-tooltip__arrow` inside, `next-tooltip--visible` while shown and `data-placement`
`top` or `bottom`. Its default styles are added once, in `<style id="next-tooltip-styles">`; page
CSS for these classes overrides them.
