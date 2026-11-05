---
title: 'Variant slots'
group: 'Attribute Reference/Bundles'
order: 305
---

# Variant slots

A card line with `"configurable": true` becomes one slot per unit, and each slot can be a different
variant of the product: three shirts, each in its own size. The selector names a template; the SDK
draws one copy of it per slot of the picked card.

```html
<div data-next-bundle-selector data-next-selector-id="shirts" data-next-bundle-slot-template-id="shirt-slot">
  <div
    data-next-bundle-card
    data-next-bundle-id="three"
    data-next-bundle-items='[{"packageId":10,"quantity":3,"configurable":true}]'
  >
    3 shirts
  </div>
</div>

<div data-next-bundle-slots-for="shirts"></div>

<template id="shirt-slot">
  <p>Shirt {slot.unitNumber}: {item.variantName} {item.price}</p>
  <div data-next-variant-selectors></div>
</template>
```

## Attributes

| Attribute                                              | On              | Means                                                                                                  |
| ------------------------------------------------------ | --------------- | ------------------------------------------------------------------------------------------------------ |
| `data-next-bundle-slot-template-id="<id>"`             | The selector    | The element whose content is the slot template, usually a `<template>`                                 |
| `data-next-bundle-slot-template="<html>"`              | The selector    | The template written inline, when there is no `-id`                                                    |
| `data-next-bundle-slots-for="<selector id>"`           | Anywhere        | Where that selector's slots are drawn                                                                  |
| `data-next-variant-selectors`                          | In the template | One `<select>` per variant attribute of the slot's product (size, colour…) is drawn here               |
| `next-render-no-label`                                 | On that element | Leaves out the `Select <name>:` labels                                                                 |
| `data-next-property="<name>"`                          | An input in it  | A personalisation sent with that slot's line; see [Personalisation properties](data-next-property.md)  |
| `data-next-discounts="offer\|voucher"`                 | In the template | The slot's discounts, from a `<template>` inside it; see [data-next-discounts](data-next-discounts.md) |
| `data-next-show` / `data-next-hide="item.hasDiscount"` | In the template | Shown or hidden for that slot                                                                          |

Each slot is one unit of one package. Picking a variant replaces the slot's package with the
package of that variant; an option no package has is disabled. A slot's line then goes into the
cart (in `swap` mode) and the card is priced again.

## Template tokens

| Token                                                           | Is                                       |
| --------------------------------------------------------------- | ---------------------------------------- |
| `{slot.index}` (`{slot.unitIndex}`), `{slot.unitNumber}`        | The slot's position, from `0` / from `1` |
| `{item.packageId}`, `{item.name}`, `{item.image}`, `{item.sku}` | The slot's package                       |
| `{item.productName}`, `{item.variantName}`                      | Its product and variant names            |
| `{item.quantity}`                                               | Units in the package                     |
| `{item.price}`, `{item.originalPrice}`                          | The slot's price, and before discounts   |
| `{item.unitPrice}`, `{item.originalUnitPrice}`                  | Per unit                                 |
| `{item.discountAmount}`, `{item.discountPercentage}`            | What the discount takes off              |
| `{item.hasDiscount}`                                            | `show` or `hide`                         |
| `{item.currency}`                                               | The campaign currency                    |

Prices come from the card's server price once it arrives, and from the campaign's packages until
then. Paths such as `data-next-display="cart.total"` work inside a slot too.

## Set by the SDK

Each slot is a `div.next-bundle-slot` with `data-next-bundle-id` and `data-next-slot-index`. The
variant fields are `div.next-slot-variant-field` (with `data-next-variant-code`,
`data-next-variant-name`), `label.next-slot-variant-label` and `select.next-slot-variant-select`.

## Events

[selector.updated](/event-reference/selectors/selector.updated) when a slot's variant or
properties change.
