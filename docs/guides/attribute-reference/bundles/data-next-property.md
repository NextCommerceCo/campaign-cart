---
title: 'Personalisation properties'
group: 'Attribute Reference/Bundles'
order: 306
---

# Personalisation properties

Text the shopper types, such as an engraving, sent with a line as a property of that line. It works
on [variant slots](data-next-bundle-slot-template-id.md) and on
[order bumps](../cart/data-next-toggle-card.md).

```html
<!-- in a slot template -->
<input data-next-property="engraving" placeholder="Engraving" />

<!-- once on the page: added to every slot and bump line -->
<input data-next-default-property="gift_note" placeholder="Gift note" />

<!-- this card's lines leave the gift note out -->
<div data-next-bundle-card data-next-exclude-property="gift_note" …>…</div>
```

## Attributes

| Attribute                               | On                         | Means                                                                    |
| --------------------------------------- | -------------------------- | ------------------------------------------------------------------------ |
| `data-next-property="<name>"`           | An input in a slot or bump | Sent as `<name>` with that line                                          |
| `data-next-default-property="<name>"`   | An input anywhere          | Sent as `<name>` with every slot and bump line                           |
| `data-next-exclude-property="<name,…>"` | A bundle card or a bump    | Leaves these page-wide properties off its lines; `*` leaves them all off |

An empty input sends nothing, and values are trimmed. A line's own `data-next-property` wins over a
page-wide one of the same name. The value is read when the input changes, so the cart line updates
then.
