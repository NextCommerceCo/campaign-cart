---
title: 'Payment methods'
group: 'Attribute Reference/Checkout'
order: 507
---

# Payment methods

Each method is a radio and, if it needs one, a panel. The picked method is what the order is placed
with. A card is entered in fields the payment provider draws inside the page's elements, so the page
never reads the card.

```html
<div data-next-payment-method="card_token">
  <label><input type="radio" name="payment_method" value="card_token" checked /> Card</label>
  <div data-next-payment-form>
    <div data-next-checkout-field="cc-number"></div>
    <div data-next-checkout-field="cvv"></div>
    <select data-next-checkout-field="exp-month"></select>
    <select data-next-checkout-field="exp-year"></select>
  </div>
</div>

<div data-next-payment-method="paypal">
  <label><input type="radio" name="payment_method" value="paypal" /> PayPal</label>
</div>
```

## Attributes

| Attribute                                             | Means                                                                                                        |
| ----------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| `input[type="radio"][name="payment_method"]`          | A method to pick. `value` is the method's code: `card_token`, `paypal`, `klarna`, …                          |
| `data-next-payment-method="<code>"`                   | That method's panel. A panel for a method the campaign does not offer is hidden; the card panel always shows |
| `data-next-payment-form`                              | Inside a panel: opened while its method is picked, collapsed otherwise                                       |
| `data-next-checkout-field="cc-number"` / `"cvv"`      | Where the card number and security code are drawn                                                            |
| `data-next-checkout-field="exp-month"` / `"exp-year"` | `<select>`s for the expiry; left empty, they are filled with the 12 months and the next 20 years             |

`credit`, `credit-card`, `card` and `card_token` all mean a card; `-` and `_` read the same. The
first time, the radio picked is the one the shopper chose earlier in this tab, else the one
`checked`, else the first one shown.

A method picked in the form is checked like a card: every field the form asks for. A card also
needs a valid number and security code, and an expiry that has not passed. PayPal, Klarna and
other redirect methods send the shopper to the provider, who returns them to `next-success-url`
or `next-failure-url` (see [data-next-checkout](data-next-checkout.md)).

## Set by the SDK

| On                         | Set                                                                                                                                                          |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| The picked panel           | `next-selected`                                                                                                                                              |
| A panel not offered        | `next-hidden` and `display: none`                                                                                                                            |
| `[data-next-payment-form]` | `data-next-payment-state="expanded"` / `"collapsed"`, `payment-method__form--expanded` / `--collapsed`; a collapsed one gets `height: 0`                     |
| `cc-number`, `cvv`         | `id="spreedly-number"` / `"spreedly-cvv"`, `spreedly-field-transition`; `next-focused` and `has-focus` while focused; the [error classes](error-messages.md) |
| The form                   | `next-loading-spreedly` while the card fields load                                                                                                           |

## 0.4.x

| 0.4.x                                                                                           | Now                     |
| ----------------------------------------------------------------------------------------------- | ----------------------- |
| `data-next-checkout-field="payment-method"`, `os-checkout-field="payment-method"` on the radios | `name="payment_method"` |
| `cc-month`, `cc-year`                                                                           | `exp-month`, `exp-year` |
| `credit-card`                                                                                   | `card_token`            |

## Events

[payment.selected](/event-reference/checkout/payment.selected) when the method changes,
[payment.redirected](/event-reference/payments/payment.redirected) before the shopper leaves for
the provider. See the [Payments lifecycle](../../event-reference/payments/lifecycle.md).
