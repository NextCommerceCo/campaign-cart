---
title: 'Checkout'
group: 'Attribute Reference/Objects'
order: 204
---

# Checkout

`form[data-next-checkout]` is the checkout: its fields are checked as the shopper types, kept in
this tab, and sent with the order on submit. `checkout.*` reads what was entered, for a review
step, and `checkout.errors.<field>` each field's message.

```html
<form data-next-checkout data-next-go="upsell.html" data-next-lead="email">
  <input data-next-field="email" type="email" autocomplete="email" required />
  <p data-next-query="checkout.errors.email"></p>
  <div data-next-address="shipping"></div>
  <div data-next-payment></div>
  <p data-next-query="checkout.errors.payment"></p>
  <button>Pay</button>
</form>
```

## Attributes

| Attribute                                         | Means                                                                                                          |
| ------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| `form[data-next-checkout]`                        | The checkout form                                                                                              |
| `data-next-go="<url>"`                            | The page after a paid order, opened with `?ref_id` and the visit's parameters. A declined payment returns here |
| `data-next-lead="email\|phone\|email+phone\|off"` | When the shopper is saved as a lead. Default `email`                                                           |
| `data-next-step`                                  | A middle step of a multi-step checkout: submit checks the step and opens `data-next-go`                        |

Its inputs are [data-next-field](../inputs/data-next-field.md); the address, payment and express
parts are [widgets](../widgets/data-next-address.md).

## Fields

<!-- fields: Checkout -->

| Field                     | Is                                                                     |
| ------------------------- | ---------------------------------------------------------------------- |
| `checkout.errors.<field>` | The message of a field the checkout refused; `payment` for the payment |
