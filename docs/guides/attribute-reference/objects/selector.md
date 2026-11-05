---
title: 'Selector and option'
group: 'Attribute Reference/Objects'
order: 202
---

# Selector and option

`data-next-selector` is a group of `data-next-option`s, one picked. An option on its own is an
order bump: a click puts it in the cart, the next takes it out. On a page opened with `?ref_id`
both are post-purchase offers, priced for the order and added with
[acceptUpsell](../actions/action-list.md).

```html
<div data-next-selector="main">
  <div data-next-option="one" data-next-items="1">…</div>
  <div data-next-option="three" data-next-items="1x3" data-next-vouchers="TRIO10" data-next-selected>
    <span data-next-query="price"></span> each
    <s data-next-show="total_discount > 0" data-next-query="subtotal"></s>
  </div>
</div>

<div data-next-option="protect" data-next-items="9">Add protection for <span data-next-query="total"></span></div>
```

Inside an option, short paths read that option (`total`, `price`, `lines.0.image`); anywhere else,
`selector.main.total` reads the picked one and `selector.main.options.three.total` a given one. An
order bump reads as `selector.<its id>`.

## Attributes

| Attribute                                          | On          | Means                                                                                              |
| -------------------------------------------------- | ----------- | -------------------------------------------------------------------------------------------------- |
| `data-next-selector="<id>"`                        | a container | The selector. Its options are the `[data-next-option]` inside it                                   |
| `data-next-defer`                                  | selector    | The pick is only remembered; nothing goes in the cart until an `addItem` button names the selector |
| `data-next-option="<id>"`                          | option      | One option. The id names it in events, `?forceBundleId` and `selector.<id>.options.<id>`           |
| `data-next-items="1x3, 5"`                         | option      | Its lines: package id, then `x` and the quantity (1 when left out), comma-separated                |
| `data-next-selected`                               | option      | Picked first. `="false"` reads as not set                                                          |
| `data-next-vouchers="CODE, CODE"`                  | option      | Codes applied with its lines and used when it is priced                                            |
| `data-next-shipping-id="<id>"`                     | option      | The shipping method set when it goes in the cart                                                   |
| `data-next-quantity`                               | option      | How many times its lines are taken. Default `1`                                                    |
| `data-next-min-quantity`, `data-next-max-quantity` | option      | Limits for [setQuantity](../actions/action-list.md). Default `1` and `999`                         |
| `data-next-slots`                                  | option      | Each unit is a slot that can be its own variant; draw them with `data-next-each="slots"`           |

The first pick is `?forceBundleId`, else the option already in the cart, else `data-next-selected`,
else the first. Each option is priced on the server with its own vouchers; until that price
arrives, the campaign's prices show (an offer shows nothing until it is priced).

An order bump takes one package (`data-next-items="9"` or `"9x2"`).

## Set by the SDK

| On an option                         | When                              |
| ------------------------------------ | --------------------------------- |
| `data-next-selected`, `aria-pressed` | It is the picked one (a bump: on) |
| `data-next-in-cart`                  | Its lines are in the cart         |
| `data-next-loading`                  | The options are being priced      |

The 0.4.x classes (`next-selected`, `next-active`, `next-in-cart`, `next-not-in-cart`) are set too,
for CSS that already selects them.

## Fields

<!-- fields: Selector -->
