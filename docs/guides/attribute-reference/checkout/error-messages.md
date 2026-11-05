---
title: 'Error messages'
group: 'Attribute Reference/Checkout'
order: 509
---

# Error messages

A field's error shows under the field. An error that belongs to no field on screen, such as a
declined card, shows in the selected payment method's error box.

```html
<div data-next-payment-method="card_token">
  …
  <div data-next-component="credit-error" style="display: none">
    <span data-next-component="credit-error-text"></span>
  </div>
</div>
```

## Attributes

| Attribute                                   | Means                                                                           |
| ------------------------------------------- | ------------------------------------------------------------------------------- |
| `data-next-component="<method>-error"`      | The error box for a method: `credit-error`, `paypal-error`, `klarna-error`, …   |
| `data-next-component="<method>-error-text"` | Inside the box: where the text goes. Without it, the box's own text is replaced |
| `data-next-component="express-error"`       | The box for the [express buttons](data-next-express-checkout.md)                |

The box is looked for inside the selected payment panel first, then in the form, then on the
page. A method with no box of its own uses `credit-error`. `-` and `_` in the method name read the
same (`apple-pay-error`, `apple_pay-error`).

The box lists the errors the shopper cannot see: the order or payment error, then "Please check
the following fields: …" for required fields that are hidden or not on the page. Only one box shows
at a time.

Field messages come from the country's rules where it has its own, otherwise from the SDK (for
example "Email is required", "Enter a valid email address").

## Set by the SDK

| On                        | Set                                                                                  |
| ------------------------- | ------------------------------------------------------------------------------------ |
| The error box             | `display: flex`, `visible` with a message; `display: none`, `hidden` without one     |
| A field with an error     | `has-error`, `next-error-field`, `aria-invalid="true"`; its wrapper `addErrorIcon`   |
| A field left valid        | `no-error`; its wrapper `addTick`                                                    |
| The field's `.form-group` | `div.next-error-label[data-next-error-for="<field>"][role="alert"]` with the message |

After a failed submit the page scrolls to the first field with an error and focuses it.

## Events

[checkout.submitted](/event-reference/checkout/checkout.submitted) carries `valid` and the
`errors` of each submit; [checkout.failed](/event-reference/checkout/checkout.failed) and
[payment.failed](/event-reference/payments/payment.failed) carry the order and payment errors.
