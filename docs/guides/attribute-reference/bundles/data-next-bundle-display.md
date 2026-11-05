---
title: 'data-next-bundle-display'
group: 'Attribute Reference/Bundles'
order: 303
---

# data-next-bundle-display

Writes one of its card's values. It must sit inside a `[data-next-bundle-card]`. Until the card's
server price arrives, prices come from the campaign's packages.

```html
<div data-next-bundle-card data-next-bundle-id="three" data-next-bundle-items='[{"packageId":1,"quantity":3}]'>
  <span data-next-bundle-display="unitPrice"></span> each
  <s data-next-bundle-display="originalPrice"></s>
  <span data-next-bundle-display="hasDiscount">Save <span data-next-bundle-display="discountPercentage"></span></span>
</div>
```

## Properties

| Property                                                             | Is                                                            |
| -------------------------------------------------------------------- | ------------------------------------------------------------- |
| `price` (`total`)                                                    | What the card's lines cost, at its quantity                   |
| `originalPrice` (`compare`)                                          | The same lines before discounts                               |
| `discountAmount` (`savings`)                                         | `originalPrice − price`                                       |
| `discountPercentage` (`savingsPercentage`, `savingsOfferPercentage`) | `discountAmount ÷ originalPrice`                              |
| `unitPrice`, `originalUnitPrice`                                     | `price` and `originalPrice` divided by the number of units    |
| `quantity`                                                           | Units in the card: each line's quantity × its package's units |
| `hasDiscount` (`hasSavings`)                                         | `originalPrice > price`                                       |
| `isSelected`                                                         | The card is the picked one                                    |
| `name`, `image`                                                      | The first line's package name and image                       |

A `true` / `false` property shows or hides the element. Money is formatted in the campaign
currency; `data-next-format` overrides the format (see [data-next-format](../values/data-next-format.md)).

The same values are paths for [data-next-display](../values/data-next-display.md) and
[data-next-show](../values/data-next-show.md): `bundle.<card id>.<property>`, or
`bundle.<selector id>.<property>` for the selector's picked card. Inside a card, a one-word path
such as `data-next-display="price"` reads that card.

An unknown property logs a warning, as does a `data-next-bundle-display` outside a card.
