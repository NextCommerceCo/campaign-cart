---
title: 'Scroll hint'
group: 'Attribute Reference/Widgets'
order: 904
---

# Scroll hint

A "scroll for more" hint next to a list that scrolls. It is active only while the list can
scroll and is at the top.

```html
<div class="order-summary">
  <div class="cart-items__list">…</div>
  <div data-next-component="scroll-hint">Scroll for more</div>
</div>
```

## Attributes

| Attribute                              | Means                                                                                                                                                                                                                                                           |
| -------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `data-next-component="scroll-hint"`    | The hint                                                                                                                                                                                                                                                        |
| `data-next-scroll-target="<selector>"` | The list it watches. Without it, the first of `.cart-items__list`, `[data-next-cart-items]`, `[data-next-order-items]`, `.order-items__list`, `.scrollable-content` in the hint's parent, or in its nearest `.order-summary`, `.cart-items` or `.modal-content` |
| `data-next-scroll-threshold`           | Pixels from the top still counted as the top. Default `5`                                                                                                                                                                                                       |

A hint with no list to watch does nothing.

## Set by the SDK

| On the hint                       | When                                  |
| --------------------------------- | ------------------------------------- |
| `cart-items__scroll-hint--active` | The list can scroll and is at the top |
| `aria-hidden`                     | `false` while active, else `true`     |

## 0.4.x

`next.on('scroll-hint:updated', fn)` still fires, with `{ isVisible, scrollTop, scrollHeight,
clientHeight }`.
