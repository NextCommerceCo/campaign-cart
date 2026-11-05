---
title: 'data-next-query'
group: 'Attribute Reference/Display'
order: 301
---

# data-next-query

Writes a value of the object model into the element and keeps it current. The path is the one
`next.query()` takes and events carry: `cart.total`, `selector.main.price`, `order.number`.

```html
<span data-next-query="cart.total" data-next-empty="…"></span>
<img data-next-query="package.42.image" alt="" />
<a data-next-query="order.status_url">Track your order</a>
```

Inside an option, an `each` row or a `data-next-for`, a path that is not a root reads that object:
`data-next-query="total"`.

## How a value is written

| Element                       | Gets                                                                  |
| ----------------------------- | --------------------------------------------------------------------- |
| `img`, `source`               | `src` / `srcset`                                                      |
| `a`                           | `href`                                                                |
| `input`, `textarea`, `select` | `value`                                                               |
| any other                     | its text: money, percentage or number by the field's name, else as is |
| an address                    | on one line: street, city, state and postcode, country                |
| a list                        | how many items it has                                                 |

A field named `price`, `*_price`, `total`, `*_total`, `subtotal`, `tax` or `amount` is money in the
campaign's currency; `*percentage` is a percentage. A value not known yet (before the campaign or
a price arrives) is written as `data-next-empty`, or empty.

## Attributes

| Attribute                  | Means                                               |
| -------------------------- | --------------------------------------------------- |
| `data-next-empty="<text>"` | Shown while there is no value                       |
| `data-next-format`         | How a number is written, when its name does not say |

| `data-next-format` | Writes                                |
| ------------------ | ------------------------------------- |
| `currency`         | `$39.00`                              |
| `currency_code`    | `$39.00 USD`                          |
| `currency_rounded` | `$39` (no cents when they are `.00`)  |
| `percentage`       | `25%`                                 |
| `number`           | `39`                                  |
| `phone`            | a 10-digit number as `(555) 123-4567` |
| `address`          | the value as is                       |

A field a page adds with `next.define(type, name, fn, { format })` reads like the SDK's own, in
that format (see the [JavaScript API](../../javascript-api.md)).
