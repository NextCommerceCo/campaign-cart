---
title: 'Phone field'
group: 'Attribute Reference/Checkout'
order: 504
---

# Phone field

`data-next-checkout-field="phone_number"` (and `billing-phone_number`) gets the country's flag and
typing mask. The address service reads the number a moment after the shopper stops typing, and the
order sends it in E.164.

```html
<div class="form-group">
  <input data-next-checkout-field="phone_number" type="tel" placeholder="Phone" data-next-required="true" />
</div>
```

## Attributes

| Attribute                                | Means                                                |
| ---------------------------------------- | ---------------------------------------------------- |
| `required` / `data-next-required="true"` | The phone is required. Without either it is optional |

The flag follows the address country, or the number's own country once it is read. The number is
shown in its country's mask as it is typed and written nationally or internationally when the
shopper leaves the field. The page's placeholder is kept.

## Set by the SDK

| On                 | Set                                                                                           |
| ------------------ | --------------------------------------------------------------------------------------------- |
| The input          | `next-phone-input`, room on the right for the flag (`padding-right`)                          |
| The input          | `data-next-phone-country="<code>"`: the country the flag shows                                |
| The input          | `data-next-phone-e164="+…"` while the address service reads the number as valid               |
| The input's parent | `next-phone-field`                                                                            |
| Before the input   | `img.next-phone-flag` (20×15), placed inside the field's right edge, hidden without a country |

## 0.4.x

| 0.4.x                               | Now                                                      |
| ----------------------------------- | -------------------------------------------------------- |
| `data-next-checkout-field="phone"`  | `phone_number`                                           |
| `data-min-phone-digits` on the form | Not read; the address service checks the number          |
| `data-phone-field` on the form      | Not read; mark the input with `data-next-checkout-field` |
| Placeholder replaced with `Phone*`  | The page's placeholder is kept                           |

## Events

The phone is part of [user.created](/event-reference/checkout/user.created) when
[data-next-lead](data-next-lead.md) waits for it.
