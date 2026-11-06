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

## Per country

The country's [rules](https://i18n-rules-docs.next-commerce.workers.dev/countries/index/) decide the
fields, their rows and order, their labels, which are required, whether the state is a list or
text, and how the postcode and phone are formatted as the shopper types.

## CSS

The SDK draws this markup and no styles:

```html
<div data-next-address="shipping" data-next-address-state="ready">
  <div class="next-address-row">
    <div class="form-group next-address-field" data-next-address-field="city" style="flex-grow: 2">
      <input class="next-address-control" placeholder="City" />
      <label class="next-address-label">City</label>
    </div>
  </div>
</div>
```

```css
.next-address-row {
  display: flex;
  gap: 12px;
}
.next-address-field {
  flex: 1;
}
[data-next-address-state='loading'] {
  min-height: 240px; /* until the country's rules arrive */
}
```

Style a field by its name, not its position, since the order changes with the country:
`[data-next-address-field="postal"]`, with the 0.4.x names (`fname`, `address1`, `postal`,
`province`, `phone`) and `billing-` before a billing field. The label comes after its control, for
floating labels (`.next-address-control:not(:placeholder-shown) + .next-address-label`).
