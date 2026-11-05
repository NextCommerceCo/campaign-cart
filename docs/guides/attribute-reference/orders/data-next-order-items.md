---
title: 'data-next-order-items'
group: 'Attribute Reference/Orders'
order: 701
---

# data-next-order-items

Draws the order's lines, upsells included, from a template: one copy per line. Used on receipt and
upsell pages, which get the order from `?ref_id=`.

```html
<div data-next-order-items data-item-template-id="order-line"></div>

<template id="order-line">
  <div class="line">
    <img src="{item.image}" alt="" class="{item.showImage}" />
    <span>{item.name}</span> <small class="{item.showVariant}">{item.variant}</small> × {item.quantity}
    <span>{item.lineTotal}</span>
  </div>
</template>
```

## Attributes

| Attribute                             | Means                                                                                               |
| ------------------------------------- | --------------------------------------------------------------------------------------------------- |
| `data-next-order-items`               | The list. Its own content is the template when no other is named                                    |
| `data-item-template-id="<id>"`        | The template is the content of the element with that id (a `<template>` works)                      |
| `data-item-template-selector="<css>"` | The template is the content of the first element matching it                                        |
| `data-item-template="<html>"`         | The template, inline                                                                                |
| `data-empty-template="<html>"`        | Shown for an order with no lines. Default: `<div class="order-empty">No items found in order</div>` |

The first of `data-item-template-id`, `data-item-template-selector`, `data-item-template` and the
element's own content that has a template wins. With none (or only comments), each line is drawn as
`<div class="order-item">` with its image, name, quantity and line total.

## Tokens

Each `{item.<token>}` in the template is replaced, as text, for each line. An unknown token is left
as written.

| Token                                                              | Is                                               |
| ------------------------------------------------------------------ | ------------------------------------------------ |
| `{item.id}`                                                        | The order line's id                              |
| `{item.name}` (`{item.title}`), `{item.sku}`, `{item.description}` | The product                                      |
| `{item.variant}`, `{item.image}`, `{item.quantity}`                | The line's variant title, image URL and quantity |
| `{item.price}`, `{item.priceExclTax}`                              | One unit, with and without tax                   |
| `{item.lineTotal}`, `{item.lineTotalExclTax}`                      | The whole line, with and without tax             |
| `{item.isUpsell}`, `{item.hasImage}`, `{item.hasVariant}`          | `true` or `false`                                |
| `{item.showUpsell}`, `{item.showImage}`, `{item.showVariant}`      | `show` or `hide`, to use as a class              |
| `{item.upsellBadge}`                                               | `UPSELL` on an upsell line, otherwise empty      |

Money is formatted in the campaign currency.

## Set by the SDK

| On the list | Set                                                                                                                                  |
| ----------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| class       | One of `order-loading`, `order-has-items`, `order-empty`, `order-error`                                                              |
| content     | While loading: `Loading order items...`; when the order could not be loaded: `Error loading order items` (both in `.status-message`) |

The list is drawn again when an upsell is added to the order.

## Events

[order.loaded](/event-reference/orders/order.loaded) and
[order.updated](/event-reference/orders/order.updated); see the
[Order lifecycle](../../event-reference/orders/lifecycle.md).
