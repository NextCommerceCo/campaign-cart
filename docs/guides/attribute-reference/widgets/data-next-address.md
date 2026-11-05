---
title: 'data-next-address'
group: 'Attribute Reference/Widgets'
order: 601
---

# data-next-address

An address for the selected country: its fields, in its order, with its labels, drawn again when
the country changes.

```html
<div data-next-address="shipping"></div>

<div data-next-address="billing">
  <input data-next-field="line1" />
  <input data-next-field="city" />
</div>
```

Empty, the SDK draws the country's fields (a spinner or placeholder inside does not stop it). With
a `[data-next-field]` inside, the page lays out its own fields and the element is their context:
inside `data-next-address="billing"`, `line1` is the billing street.

The billing address hides itself (`hidden`) while `billing_same_as_shipping` is ticked.

Style drawn fields by attribute (`[data-next-address] [data-next-field]`), not by their position:
the order changes with the country.
