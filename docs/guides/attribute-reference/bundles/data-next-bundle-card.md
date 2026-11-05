---
title: 'data-next-bundle-card'
group: 'Attribute Reference/Bundles'
order: 302
---

# data-next-bundle-card

One option of a [bundle selector](data-next-bundle-selector.md): the lines it puts in the cart,
and the vouchers and shipping method that come with them.

```html
<div
  data-next-bundle-card
  data-next-bundle-id="duo"
  data-next-bundle-items='[{"packageId":1,"quantity":2},{"packageId":5,"quantity":1}]'
  data-next-bundle-vouchers='["DUO10"]'
  data-next-shipping-id="3"
>
  Duo pack <span data-next-bundle-display="price"></span>
</div>
```

## Attributes

| Attribute                                                                     | Means                                                                                                                                                                                                      |
| ----------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `data-next-bundle-card`                                                       | Marks a card. It must sit inside a `[data-next-bundle-selector]`                                                                                                                                           |
| `data-next-bundle-id="<id>"`                                                  | The card's id, used by `?forceBundleId`, `bundle.<id>.*` paths and events. Default: its position in the selector, from `0`                                                                                 |
| `data-next-bundle-items='[{"packageId":1,"quantity":2,"configurable":true}]'` | The card's lines, as JSON. `quantity` defaults to `1`. `configurable: true` makes one [variant slot](data-next-bundle-slot-template-id.md) per unit. A card without valid lines is skipped, with a warning |
| `data-next-bundle-vouchers='["CODE"]'`                                        | Voucher codes, as a JSON array, applied with the card's lines and used when it is priced                                                                                                                   |
| `data-next-shipping-id="<id>"`                                                | The shipping method set when the card goes into the cart                                                                                                                                                   |
| `data-next-quantity`                                                          | How many times the card's lines are taken. Default `1`                                                                                                                                                     |
| `data-next-min-quantity`, `data-next-max-quantity`                            | The card's quantity limits. Default `1` and `999`                                                                                                                                                          |
| `data-next-selected="true"`                                                   | The card picked first                                                                                                                                                                                      |

The card's quantity multiplies every line: a card of 2 × package 1 at quantity 3 is 6 × package 1.
Change it with a [quantity stepper](data-next-bundle-qty-for.md).

## Prices

Each card is priced on the server with its own vouchers and the shopper's coupons, so its price is
what the cart would charge. Until that price arrives, the campaign's package prices show. A card's
price is kept for 10 minutes, so the next page, a reload or a quantity already picked shows it
without asking the server again; a new coupon or a new quantity prices the cards again.

Show a card's values with [data-next-bundle-display](data-next-bundle-display.md), or anywhere on
the page with `data-next-display="bundle.<card id>.<property>"`.

## Set by the SDK

`next-selected`, `next-in-cart` and the other states listed on
[data-next-bundle-selector](data-next-bundle-selector.md#set-by-the-sdk); `data-next-quantity`
follows the picked card's quantity.
