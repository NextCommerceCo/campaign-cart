---
title: 'Order and upsell'
group: 'Attribute Reference/Objects'
order: 205
---

# Order and upsell

`order` is the order placed at checkout, on every page opened with `?ref_id` (the checkout adds
it). Nothing else is needed: an `order.*` path or an offer loads it.

```html
<h1>Thanks, <span data-next-query="order.user.first_name"></span></h1>
<div data-next-each="order.lines">
  <template>
    <span data-next-query="product_title"></span> × <span data-next-query="quantity"></span>
    <span data-next-query="total"></span>
  </template>
</div>
```

On the same pages an [option](selector.md) is a post-purchase offer, added with
`data-next-action="acceptUpsell"` and declined with `skipUpsell` ([Action list](../actions/action-list.md)).

## Fields

<!-- fields: Order -->
