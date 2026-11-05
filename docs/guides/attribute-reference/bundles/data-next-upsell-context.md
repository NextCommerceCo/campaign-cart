---
title: 'data-next-upsell-context'
group: 'Attribute Reference/Bundles'
order: 307
---

# data-next-upsell-context

On a bundle selector: prices its cards as a post-purchase offer (`?upsell=true` on the cart
calculation), so they show what an upsell would charge. The selector never touches the cart; its
pick is what an [upsell offer](../upsells/data-next-upsell.md) adds to the order.

```html
<section data-next-upsell="offer">
  <div data-next-bundle-selector data-next-selector-id="upsell" data-next-upsell-context>
    <div data-next-bundle-card data-next-bundle-id="one" data-next-bundle-items='[{"packageId":7,"quantity":1}]'>
      <span data-next-bundle-display="price"></span>
    </div>
  </div>
  <button data-next-upsell-action="add">Add to my order</button>
</section>
```

While the offer prices are on the way, a card's values stay empty instead of showing the campaign's
package prices.

Without this attribute, a selector on an upsell page (any page with `[data-next-upsell]`) records
its pick without touching the cart, and is priced as a normal cart.

## Events

The selector's events carry `type: 'offer'` instead of `'bundle'`; see the
[Selector lifecycle](../../event-reference/selectors/lifecycle.md).
