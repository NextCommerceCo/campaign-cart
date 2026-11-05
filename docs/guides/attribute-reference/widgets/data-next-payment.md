---
title: 'data-next-payment'
group: 'Attribute Reference/Widgets'
order: 602
---

# data-next-payment

The payment methods the campaign offers. A method turned on in the campaign appears; one turned
off disappears.

```html
<div data-next-payment></div>
<p data-next-query="checkout.errors.payment"></p>
```

Empty, the SDK draws one radio per method, in the campaign's order, with the card fields under the
card. For your own layout, put the fields inside; a radio for a method the campaign does not offer
is hidden with its label:

```html
<div data-next-payment>
  <label><input type="radio" data-next-field="payment_method" value="card_token" /> Card</label>
  <div data-next-show="checkout.payment_method == card_token">
    <div data-next-field="card.number"></div>
    <div data-next-field="card.cvv"></div>
    <input data-next-field="card.expiry" placeholder="MM / YY" />
  </div>
  <label><input type="radio" data-next-field="payment_method" value="paypal" /> PayPal</label>
</div>
```

`card.number` and `card.cvv` are empty containers: the payment provider draws its fields inside.

## Set by the SDK

`data-next-value="<method>"` on each drawn method, and `data-next-selected` on the picked one.
