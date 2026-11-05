---
title: 'data-next-field'
group: 'Attribute Reference/Inputs'
order: 501
---

# data-next-field

Every input the SDK reads. Its value goes to that field of the object around it: the checkout, an
address, a line, or the action of the form it is in.

```html
<form data-next-checkout>
  <input data-next-field="email" type="email" autocomplete="email" required />
  <label><input data-next-field="billing_same_as_shipping" type="checkbox" checked /> Same as shipping</label>
  <div data-next-address="billing"></div>
</form>

<div data-next-option="tee" data-next-items="12">
  <select data-next-field="variants.size"></select>
  <div data-next-field="variants.color"></div>
</div>
```

## Names

| Where                                   | Names                                                                                                           |
| --------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| a checkout form                         | `email`, `first_name`, `last_name`, `phone`, `accepts_marketing`, `billing_same_as_shipping`                    |
| a checkout form, or `data-next-address` | `country`, `line1`, `line2`, `city`, `state`, `postcode`; inside `data-next-address="billing"` the billing ones |
| `data-next-payment`                     | `payment_method` (radios), `card.number`, `card.cvv` (empty containers), `card.expiry` (`MM / YY`)              |
| an option, a slot, a line               | `variants.<code>`: a variant picker; `properties.<name>`: text sent with the line                               |
| a `form[data-next-action]`              | an argument of the action: `code`, `quantity`, …                                                                |

HTML does the rest: `required`, `type`, `autocomplete`.

## Variant pickers

On a `<select>`, the SDK fills one `<option>` per value. On any other element it draws one button
per value, `data-next-value="<value>"` (lowercase), with `data-next-selected` on the picked one and
`disabled` on one no package has; style swatches with CSS:

```css
[data-next-value='black'] {
  background: #111;
  font-size: 0;
}
```

For your own markup, repeat the values with `data-next-each="variants.color"` and a button with
`data-next-action="selectVariant"` in each row (rows have `value`, `name`, `available`,
`selected`, `price`).

## Set by the SDK

`data-next-invalid` and `aria-invalid` on a field with an error; the message reads as
`checkout.errors.<name>`.
