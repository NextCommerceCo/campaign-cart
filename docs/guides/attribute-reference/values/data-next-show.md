---
title: 'data-next-show / data-next-hide'
group: 'Attribute Reference/Values'
order: 202
---

# data-next-show / data-next-hide

Shows or hides an element from a value, and updates as the value changes. `data-next-show` shows
the element while the condition holds; `data-next-hide` hides it.

```html
<p data-next-show="cart.isEmpty">Your cart is empty</p>
<p data-next-show="cart.hasCoupon">Code <span data-next-display="cart.discountCode"></span> applied</p>
<div data-next-hide="param.banner == 'off'">…</div>
```

## Conditions

Any [display path](data-next-display.md#paths) works.

| Condition     | Holds when                                                                             |
| ------------- | -------------------------------------------------------------------------------------- |
| `path`        | The value is set: yes, a number other than 0, text other than `''`, `'false'` or `'0'` |
| `!path`       | It is not                                                                              |
| `path == 'x'` | The value, as text, is exactly `x` (quotes optional: `path == x`)                      |
| `path != 'x'` | It is anything else                                                                    |

`path()` is read as `path`. Nothing else is understood: `&&`, `||`, `>` and `<` log
`cannot read data-next-show="…"` and the element is left alone. A path the SDK does not know logs
one warning.

Before the campaign or the order arrives, yes/no values read as no, so a `data-next-show` element
stays hidden until its value is known.

## Set by the SDK

| On the element  | Set                                                                 |
| --------------- | ------------------------------------------------------------------- |
| `style.display` | `none` while hidden; cleared while shown, so the page's CSS applies |
| class           | `next-visible` or `next-hidden`                                     |

Put `data-next-display` on a child element rather than the same one when the value should be
written inside: a yes/no display path on its own already shows and hides.

## 0.4.x

| 0.4.x                         | Now        |
| ----------------------------- | ---------- |
| `cart.hasItems()` (with `()`) | Still read |
