---
title: 'data-next-checkout-review'
group: 'Attribute Reference/Checkout'
order: 511
---

# data-next-checkout-review

Shows what the shopper entered, usually on a later step of a
[multi-step checkout](data-next-checkout-step.md).

```html
<p>Contact <span data-next-checkout-review="email"></span></p>
<p>Ship to <span data-next-checkout-review="address" data-next-fallback="—"></span></p>
<p>Method <span data-next-checkout-review="shippingMethod.name"></span></p>
```

## Attributes

| `data-next-checkout-review` | Shows                                                                                                                   |
| --------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| `<field>`                   | A field as typed: `email`, `first_name`, `line1`, `city`, `phone_number`, … (0.4.x names such as `fname` read the same) |
| `billingAddress.<field>`    | A billing field                                                                                                         |
| `address`                   | The shipping address on one line: street, city, state, postcode, country                                                |
| `billingAddress`            | The billing address on one line                                                                                         |
| `shippingMethod.<prop>`     | A property of the cart's shipping method, such as `name`                                                                |
| `phone`                     | The phone, as `(555) 123-4567` for a 10-digit number                                                                    |

| Attribute                     | Means                                               |
| ----------------------------- | --------------------------------------------------- |
| `data-next-fallback="<text>"` | Shown while there is nothing to show                |
| `data-next-format="phone"`    | Writes the value as a phone number, as `phone` does |

## Set by the SDK

`next-review-empty` on the element while there is nothing to show.
