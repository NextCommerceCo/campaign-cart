---
title: 'Recipes/Order bump'
group: 'Recipes'
category: 'Recipes'
order: 3
---

# Order bump

A tick box under the main offer: "Add a protection plan for $9.00". A click adds it to the cart and
ticks it, the next click takes it out.

```html
<div data-next-selector="main">
  <button data-next-option="one" data-next-items="1" data-next-selected>1 pair</button>
  <button data-next-option="two" data-next-items="1x2">2 pairs</button>
</div>

<label class="bump" data-next-option="protect" data-next-items="9">
  <input type="checkbox" />
  Add a protection plan for <span data-next-query="price"></span>
</label>

<p data-next-show="selector.protect.in_cart">Your earbuds are protected.</p>
```

An option outside any selector is a bump of one package (`"9"`, or `"9x2"` for two). Inside it,
short paths read the bump (`price`, `total`, `in_cart`); elsewhere it reads as `selector.<its id>`.
A click on the bump, its text or its checkbox switches it once, and the SDK keeps the checkbox
ticked while the bump is in the cart. A `button` or `div` without a checkbox works too: draw the
tick with CSS on `data-next-selected`. A link, `select` or text input inside the bump keeps its
own clicks.

| Style                        | When                                 |
| ---------------------------- | ------------------------------------ |
| `.bump[data-next-selected]`  | it is in the cart                    |
| `.bump[aria-pressed='true']` | the same, for screen readers and CSS |

**Events**: `selector.selected` when it goes in, `selector.deselected` when it comes out, each with
`cart.added` / `cart.removed`.

**See also**: [Selector and option](../attribute-reference/objects/selector.md) for the option
attributes, [Prices and savings](prices-and-savings.md) for its price fields.
