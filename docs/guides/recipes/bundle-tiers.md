---
title: 'Recipes/Bundle tiers'
group: 'Recipes'
category: 'Recipes'
order: 1
---

# Bundle tiers

Cards for one, two or three pairs, the middle one picked, each with its price per pair and what the
shopper saves.

```html
<div data-next-selector="tiers">
  <button data-next-option="one" data-next-items="1">1 pair · <span data-next-query="total"></span></button>
  <button data-next-option="two" data-next-items="1x2" data-next-vouchers="DUO5" data-next-selected>
    <b>Most popular</b> 2 pairs · <span data-next-query="price"></span> each
    <span data-next-show="discount_percentage > 0">Save <span data-next-query="discount_percentage"></span></span>
  </button>
  <button data-next-option="three" data-next-items="1x3" data-next-vouchers="TRIO10">
    3 pairs · <span data-next-query="price"></span> each
    <s data-next-show="total_discount > 0" data-next-query="original_price"></s>
  </button>
</div>
```

Each card is priced by the server with its own `data-next-vouchers`, so the savings shown are the
ones the order gets. `total` is the whole card and `price` is `total ÷` the card's package count:
with `1x3`, the price of one pair. A card holding one bundle package (`data-next-items="7"`) has a
`price` equal to its `total`.

| Style                                    | When                                     |
| ---------------------------------------- | ---------------------------------------- |
| `[data-next-option][data-next-selected]` | the picked card                          |
| `[data-next-option][data-next-loading]`  | its price is being fetched: dim the card |

**Events**: `selector.selected` on a pick, then `cart.added` / `cart.removed` for what changed.

**See also**: [Selector and option](../attribute-reference/objects/selector.md) for every option
attribute and field, [Quantity stepper](quantity-stepper.md) to multiply the picked card.
