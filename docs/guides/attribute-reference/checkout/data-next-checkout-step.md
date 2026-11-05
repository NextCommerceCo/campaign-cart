---
title: 'data-next-checkout-step'
group: 'Attribute Reference/Checkout'
order: 510
---

# data-next-checkout-step

Splits the checkout across pages. On a form with `data-next-checkout-step`, submit checks the
contact and shipping fields and opens the next step instead of placing the order. The last step
has no `data-next-checkout-step` and places the order.

```html
<!-- information.html -->
<form data-next-checkout data-next-checkout-step="shipping.html">…</form>

<!-- shipping.html -->
<form data-next-checkout data-next-checkout-step="payment.html">…</form>

<!-- payment.html -->
<form data-next-checkout>…</form>
```

## Attributes

| Attribute                         | Means                                                                                                                                                              |
| --------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `data-next-checkout-step="<url>"` | The next step. It opens with the visit's parameters                                                                                                                |
| `data-next-step-number="<n>"`     | This page's step number. Without it, the number this page had before in the tab, else the step the shopper has reached past 1, else `1` on a form with a next step |

What was typed carries to the next page, so a later step can show it with
[data-next-checkout-review](data-next-checkout-review.md). The phone is required on step 1 when
its field asks for it.

## 0.4.x

| 0.4.x                                   | Now                                                                                                                                                                    |
| --------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `os-checkout-step`                      | `data-next-checkout-step`                                                                                                                                              |
| `sessionStorage['next-checkout-store']` | Still written in the 0.4.x shape (`step`, `formData` under 0.4.x field names, `shippingMethod`) on each step, for page guard scripts; removed once the order is placed |

## Events

[checkout.continued](/event-reference/checkout/checkout.continued) when a step is passed. See the
[Checkout lifecycle](../../event-reference/checkout/lifecycle.md).
