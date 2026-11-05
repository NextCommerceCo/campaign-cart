---
title: 'Building Pages/Checkout Page'
group: 'Building Pages'
category: 'Building Pages'
---

# Checkout Page

The checkout turns the cart into an order. A `form[data-next-checkout]` loads the checkout code;
the page tells it where to send the shopper once they have paid.

```html
<head>
  <meta name="next-success-url" content="upsell.html" />
  <meta name="next-failure-url" content="checkout.html" />
  <script type="module" src=".../loader.js" data-campaign="pk_…" data-funnel="my-funnel"></script>
</head>
```

| Meta               | Means                                                                                                            |
| ------------------ | ---------------------------------------------------------------------------------------------------------------- |
| `next-success-url` | The page after a paid order (an upsell or the receipt), opened with `?ref_id=<order>` and the visit's parameters |
| `next-failure-url` | The page a declined or cancelled payment returns to. Without it, this page with `?payment_failed=true`           |

Without `next-success-url` the SDK logs an error: a paid order goes to the store's order page,
where the purchase is not tracked.

## The cart on the page

A checkout often keeps its own bundle selector, so the shopper can change their pick here. The
summary shows lines and totals and gets `next-calculating` while new prices are on the way.

```html
<div data-next-cart-summary></div>

<dl>
  <dt>Subtotal</dt>
  <dd data-next-display="cart.subtotal"></dd>
  <dt>Shipping</dt>
  <dd data-next-hide="shipping.isFree" data-next-display="shipping.cost"></dd>
  <dd data-next-show="shipping.isFree">Free</dd>
  <dt data-next-show="cart.hasCoupon">Discount</dt>
  <dd data-next-show="cart.hasCoupon" data-next-display="cart.discountAmount"></dd>
  <dt>Total</dt>
  <dd data-next-display="cart.total"></dd>
</dl>

<div data-next-coupon>
  <input type="text" placeholder="Coupon" />
  <button type="button">Apply</button>
</div>
```

An order bump is a `data-next-toggle-card` with its package (see
[Order bumps and cart](../attributes.md#order-bumps-and-cart)).

## Contact and address

Name each input with `data-next-checkout-field`. The SDK checks every field, saves what was typed
in this tab, and marks the field's `.form-group` with `has-error` or `no-error`.

```html
<form data-next-checkout>
  <div class="form-group"><input data-next-checkout-field="email" type="email" /></div>
  <div class="form-group"><input data-next-checkout-field="first_name" /></div>
  <div class="form-group"><input data-next-checkout-field="last_name" /></div>
  <div class="form-group"><select data-next-checkout-field="country"></select></div>
  <div class="form-group"><input data-next-checkout-field="line1" /></div>
  <div data-next-component="location">
    <div class="form-group"><input data-next-checkout-field="city" /></div>
    <div class="form-group"><select data-next-checkout-field="state"></select></div>
    <div class="form-group"><input data-next-checkout-field="postcode" /></div>
  </div>
  <div class="form-group"><input data-next-checkout-field="phone_number" type="tel" /></div>
  …
</form>
```

The country list is the campaign's shipping countries. Once a country is picked, city, state and
postcode take that country's labels, order and format; a `<div data-next-address="shipping">`
instead draws the whole address for the country. The phone field gets the country's flag and mask.

For a billing address, add `input[name="use_shipping_address"]` and a
`data-next-component="billing-form"` with the same fields prefixed `billing-`.

As soon as the shopper has a name and an email, the checkout saves them as a lead (`user.created`),
the cart that `cart.abandoned` follows up. `data-next-lead` changes when; see
[Lead capture](../attributes.md#lead-capture).

## Payment

Each method is a radio and a panel. A panel for a method the campaign does not offer is hidden;
the picked panel gets `next-selected` and its `data-next-payment-form` opens.

```html
<div data-next-payment-method="card_token">
  <label><input type="radio" name="payment_method" value="card_token" checked /> Card</label>
  <div data-next-payment-form>
    <div data-next-checkout-field="cc-number"></div>
    <div data-next-checkout-field="cvv"></div>
    <select data-next-checkout-field="exp-month"></select>
    <select data-next-checkout-field="exp-year"></select>
  </div>
  <div data-next-component="credit-error"><span data-next-component="credit-error-text"></span></div>
</div>

<div data-next-payment-method="paypal">
  <label><input type="radio" name="payment_method" value="paypal" /> PayPal</label>
  <div data-next-component="paypal-error"><span data-next-component="paypal-error-text"></span></div>
</div>

<div data-next-express-checkout="buttons"></div>

<button type="submit">Complete order</button>
```

The card number and CVV are drawn by the payment provider inside those elements; the page never
sees the card. Errors show in the selected method's `-error` box, or `credit-error` when it has
none. Express buttons (Apple Pay, Google Pay, PayPal) are added to
`data-next-express-checkout="buttons"` and place the order with the wallet's details.

## Multi-step checkout

Split the form across pages with `data-next-checkout-step` (the next step's URL) on each step's
form. Submitting a step checks the form and opens the next step, carrying the visit's parameters;
the last step is the one with the payment and no `data-next-checkout-step`. `data-next-checkout-review="<field>"` shows on a later step what was
entered on an earlier one:

```html
<form data-next-checkout data-next-checkout-step="payment.html">…</form>

<!-- payment.html -->
<p>Ship to <span data-next-checkout-review="address"></span></p>
```

Events for each step are in the [Checkout lifecycle](../event-reference/checkout/lifecycle.md), and
for paying in the [Payments lifecycle](../event-reference/payments/lifecycle.md).
