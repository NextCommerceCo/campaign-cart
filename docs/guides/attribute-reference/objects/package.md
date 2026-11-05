---
title: 'Package'
group: 'Attribute Reference/Objects'
order: 203
---

# Package

`package.<id>` is a package of the campaign as one cart line at the campaign's price: no attribute
puts it on the page. Use it to show a package's name, image or price outside any option.

```html
<div data-next-for="package.42">
  <img data-next-query="image" alt="" />
  <h3 data-next-query="product_title"></h3>
  <span data-next-query="price"></span>
</div>
```

It has the fields of a cart line ([Cart](cart.md)), with `total = price` and no discount: the
server's price for a pick is on its [option](selector.md).
