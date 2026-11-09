---
title: 'Recipes/Prices and savings'
group: 'Recipes'
category: 'Recipes'
order: 2
---

# Prices and savings

A package card with its price, the price before discounts struck through, and "Save 20%", next to
the campaign's price for one pair.

```html
<div data-next-selector="main">
  <button data-next-option="three" data-next-items="1x3" data-next-vouchers="TRIO10" data-next-selected>
    3 pairs · <span data-next-query="price"></span> each
    <s data-next-show="total_discount > 0" data-next-query="original_price"></s>
    <span data-next-show="discount_percentage > 0">Save <span data-next-query="discount_percentage"></span></span>
    <small>Total <span data-next-query="total"></span></small>
  </button>
</div>

<p>One pair: <span data-next-query="package.1.price"></span></p>
```

Inside an option the numbers are the server's price for that option with its `data-next-vouchers`:
`total` is what it costs, `price` is `total ÷` its package count, `original_price` is the same
before discounts and `discount_percentage` is `total_discount ÷ subtotal × 100`. `package.1.price`
is the campaign's price for package 1, with no discount. The campaign's retail (compare-at) price
is not a field of the object model, so a fixed compare-at price is written into the markup.

| Style                                    | When                                       |
| ---------------------------------------- | ------------------------------------------ |
| `[data-next-option][data-next-loading]`  | its price is being fetched                 |
| `[data-next-option][data-next-selected]` | the picked card                            |
| `[hidden]`                               | a `data-next-show` condition does not hold |

**Events**: `selector.pricing` when pricing starts, `selector.priced` once every option has a price.

**See also**: [Selector and option](../attribute-reference/objects/selector.md) and
[Package](../attribute-reference/objects/package.md) for every field,
[data-next-query](../attribute-reference/display/data-next-query.md) for how money and percentages
are written.
