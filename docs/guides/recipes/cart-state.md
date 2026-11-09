---
title: 'Recipes/Cart state'
group: 'Recipes'
category: 'Recipes'
order: 6
---

# Cart state

A cart summary: each line with a remove button, the item count, what the shopper saves, and a
message once the cart is empty.

```html
<div data-next-selector="main">
  <button data-next-option="one" data-next-items="1" data-next-selected>1 pair</button>
  <button data-next-option="two" data-next-items="1x2" data-next-vouchers="DUO5">2 pairs</button>
</div>

<p data-next-hide="cart.lines">Your cart is empty.</p>
<div data-next-show="cart.lines">
  <p>Items: <span data-next-query="cart.quantity"></span></p>
  <div data-next-each="cart.lines">
    <template>
      <div class="line">
        <img data-next-query="image" alt="" />
        <span data-next-query="product_title"></span> × <span data-next-query="quantity"></span>
        <span data-next-query="total"></span>
        <button data-next-action="removeItem">Remove</button>
      </div>
    </template>
  </div>
  <p data-next-show="cart.total_discount > 0">You save <span data-next-query="cart.total_discount"></span></p>
  <p>Total <span data-next-query="cart.total" data-next-empty="…"></span></p>
</div>
```

A list is a condition: `cart.lines` holds while the cart has a line. `data-next-each` draws the
template once per line, and each copy reads its line with short paths; `removeItem` takes the
line's package from it. `cart.quantity` counts packages, so two of one package count as 2.

| Style                                   | When                                |
| --------------------------------------- | ----------------------------------- |
| `[data-next-each][data-next-empty]`     | the list has no lines               |
| `[data-next-option][data-next-in-cart]` | that option's lines are in the cart |

**Events**: `cart.updated` on every change, `cart.removed` for a removed line, `cart.calculated`
when the new totals arrive.

**See also**: [Cart](../attribute-reference/objects/cart.md) for every field,
[data-next-each](../attribute-reference/display/data-next-each.md) and
[data-next-show](../attribute-reference/display/data-next-show.md).
