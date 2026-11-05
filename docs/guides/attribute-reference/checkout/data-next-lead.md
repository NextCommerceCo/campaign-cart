---
title: 'data-next-lead'
group: 'Attribute Reference/Checkout'
order: 506
---

# data-next-lead

When the checkout saves the shopper as a lead: the Open Cart that `cart.abandoned` follows up. By
default that is as soon as they have entered a first and last name of at least two characters each
and a valid email.

```html
<form data-next-checkout data-next-lead="email+phone"></form>
```

## Attributes

| `data-next-lead`  | The lead is saved once the name and                |
| ----------------- | -------------------------------------------------- |
| `email` (default) | a valid email                                      |
| `phone`           | a valid phone number (read by the address service) |
| `email+phone`     | both                                               |
| `off`             | never                                              |

`email phone`, `Email + Phone` or `phone,email` read the same as `email+phone`. A value the checkout
cannot read logs a warning and uses `email`.

Once saved, a later change to the name, email, phone or `accepts_marketing` updates the lead.

## 0.4.x

| 0.4.x                                    | Now                                                                                              |
| ---------------------------------------- | ------------------------------------------------------------------------------------------------ |
| `data-trigger-on="emailEntry"`           | `email`                                                                                          |
| `data-trigger-on="phoneEntry"`           | `phone`                                                                                          |
| `data-trigger-on="emailAndPhone"`        | `email+phone`                                                                                    |
| `data-trigger-on="manual"`               | `off`                                                                                            |
| `data-trigger-on="formStart"`            | Still read: saves as soon as an email, a name or a phone is filled, without waiting for the rest |
| `data-auto-create="false"`               | `off`                                                                                            |
| `data-prospect-config`                   | Not read                                                                                         |
| `data-email-field`                       | Not read; mark the input with `data-next-checkout-field`                                         |
| `next:prospect-cart-created` on the form | Still fired. Scripts can use `next.on('user.created')`                                           |

`data-next-lead` wins over `data-trigger-on` when a form has both.

## Events

[user.created](/event-reference/checkout/user.created) when the lead is saved,
[user.updated](/event-reference/checkout/user.updated) when it changes.
