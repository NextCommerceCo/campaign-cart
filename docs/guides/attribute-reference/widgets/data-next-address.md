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
    <div class="form-group next-address-field" data-next-address-field="address2">
      <input class="next-address-control has-error" placeholder="Apartment, suite, etc. (optional)" />
      <label class="next-address-label">Apartment, suite, etc. (optional)</label>
      <div class="next-error-label">Address line 2 can’t contain emojis</div>
    </div>
  </div>
</div>
```

| Selector                    | Is                                                                                                      |
| --------------------------- | ------------------------------------------------------------------------------------------------------- |
| `.next-address-row`         | A row. The city, state and postcode row gets an inline `display` when shown: never hide it `!important` |
| `.next-address-field`       | A field and its label; a wider one has an inline `flex-grow`                                            |
| `.next-address-control`     | The input or select; every input has a placeholder                                                      |
| `.next-address-label`       | Its label, after the control                                                                            |
| `.has-error`                | A control that failed. Fields the page writes get it too                                                |
| `.next-error-label`         | The message, added to the field's `.form-group`                                                         |
| `[data-next-address-state]` | `loading` until the country's rules arrive, then `ready`                                                |

Style a field by its name, not its position, since the order changes with the country:
`[data-next-address-field="postal"]`, with the 0.4.x names (`fname`, `address1`, `postal`,
`province`, `phone`) and `billing-` before a billing field.

Bordered fields with floating labels:

```css
[data-next-address] .next-address-row {
  display: flex;
  gap: 16px;
  margin-bottom: 16px;
}
[data-next-address] .next-address-field {
  position: relative;
  flex: 1;
  min-width: 0;
}
[data-next-address-state='loading'] {
  min-height: 256px;
}
.next-address-control {
  box-sizing: border-box;
  width: 100%;
  height: 48px;
  padding: 18px 12px 4px;
  border: 1px solid #c9ccd1;
  border-radius: 8px;
  font: inherit;
}
.next-address-control:placeholder-shown {
  padding: 12px;
}
select.next-address-control {
  appearance: none;
}
.next-address-label {
  position: absolute;
  top: 6px;
  left: 13px;
  color: #6b7280;
  font-size: 11px;
  pointer-events: none;
}
.next-address-control:placeholder-shown + .next-address-label {
  display: none;
}
.has-error {
  border-color: #dc2626;
}
.next-error-label {
  margin-top: 4px;
  color: #dc2626;
  font-size: 12px;
}
```
