---
title: 'data-next-show'
group: 'Attribute Reference/Display'
order: 302
---

# data-next-show

Shows the element while the condition holds. [data-next-hide](data-next-hide.md) is the opposite.

```html
<p data-next-show="cart.total >= 75">Free shipping</p>
<s data-next-show="total_discount > 0" data-next-query="subtotal"></s>
```

## Conditions

| Condition                     | Holds when                                                                                         |
| ----------------------------- | -------------------------------------------------------------------------------------------------- |
| `path`                        | The value is set: a list with items, a number other than 0, text other than `''`, `'false'`, `'0'` |
| `!path`                       | It is not                                                                                          |
| `path == x`, `path != x`      | The value, as text, is `x` or not; quotes optional                                                 |
| `path > n`, `<`, `>=`, `<=`   | A number compared with a number or another path                                                    |
| `a && b`, `a \|\| b`, `( … )` | Both, either; `&&` before `\|\|`                                                                   |

There are no booleans to remember: `total_discount > 0`, not `hasDiscount`; `cart.lines`, not
`hasItems`.

## Set by the SDK

`hidden` while hidden (and `style.display` `none`, with `next-visible` / `next-hidden` for CSS that
selects them).
