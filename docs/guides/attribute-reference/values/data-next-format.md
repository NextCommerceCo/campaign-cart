---
title: 'data-next-format'
group: 'Attribute Reference/Values'
order: 203
---

# data-next-format

Changes how a [data-next-display](data-next-display.md) number is written. Without it, each path
is written in its own type: money as currency, percentages as `25%`, and text (such as a URL
parameter) as is.

```html
<!-- landing.html?price=25 -->
<span data-next-display="param.price" data-next-format="currency"></span>
```

## Attributes

| `data-next-format` | Writes the number as                                                                                                 |
| ------------------ | -------------------------------------------------------------------------------------------------------------------- |
| `currency`         | Money in the campaign currency (`25` → `$25.00`)                                                                     |
| `percentage`       | A whole percentage (`25` → `25%`)                                                                                    |
| `phone`            | Only on [data-next-checkout-review](../checkout/data-next-checkout-review.md): a 10-digit number as `(555) 123-4567` |

Any other value is ignored and the path's own type is used.
