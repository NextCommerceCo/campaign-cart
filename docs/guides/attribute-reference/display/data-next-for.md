---
title: 'data-next-for'
group: 'Attribute Reference/Display'
order: 305
---

# data-next-for

Names the object its children read short paths from, and that actions inside it act on.

```html
<div data-next-for="selector.main">
  <button data-next-action="setQuantity" data-next-quantity="-1">−</button>
  <span data-next-query="quantity"></span>
  <button data-next-action="setQuantity" data-next-quantity="+1">+</button>
</div>

<div data-next-for="package.42">
  <h3 data-next-query="product_title"></h3>
  <span data-next-query="price"></span>
</div>
```

A path that is a root (`cart.total`) still reads the root from inside it.
