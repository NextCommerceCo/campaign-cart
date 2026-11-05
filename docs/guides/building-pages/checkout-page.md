---
title: 'Building Pages/Checkout Page'
group: 'Building Pages'
category: 'Building Pages'
---

# Checkout Page

The checkout turns the cart into an order. A `form[data-next-checkout]` loads the checkout code,
and its `data-next-go` names the page the shopper goes to once they have paid (an upsell or the
receipt, opened with `?ref_id=<order>` and the visit's parameters). A declined or cancelled payment
comes back to this page.

```html
<form data-next-checkout data-next-go="upsell.html">…</form>
```

## The cart on the page

A checkout often keeps its own selector, so the shopper can change their pick here, and lists the
cart with [data-next-each](../attribute-reference/display/data-next-each.md):

```html
<div data-next-each="cart.lines">
  <template>
    <div class="line">
      <span data-next-query="product_title"></span> × <span data-next-query="quantity"></span>
      <span data-next-query="total"></span>
    </div>
  </template>
</div>

<dl>
  <dt>Subtotal</dt>
  <dd data-next-query="cart.subtotal"></dd>
  <dt>Shipping</dt>
  <dd data-next-show="cart.shipping_method.price > 0" data-next-query="cart.shipping_method.price"></dd>
  <dd data-next-show="cart.shipping_method.price == 0">Free</dd>
  <dt data-next-show="cart.total_discount > 0">Discount</dt>
  <dd data-next-show="cart.total_discount > 0" data-next-query="cart.total_discount"></dd>
  <dt>Total</dt>
  <dd data-next-query="cart.total"></dd>
</dl>

<form data-next-action="applyCoupon">
  <input data-next-field="code" placeholder="Coupon" />
  <button>Apply</button>
</form>
<p data-next-query="errors.code"></p>
```

An order bump is an option on its own (see [Selector and option](../attribute-reference/objects/selector.md)):

```html
<div data-next-option="protect" data-next-items="9">Add protection for <span data-next-query="total"></span></div>
```

## Contact and address

Name each input with [data-next-field](../attribute-reference/inputs/data-next-field.md). The SDK
checks every field as the shopper leaves it, saves what was typed in this tab, and gives a field
with an error `data-next-invalid`; its message reads as `checkout.errors.<field>`.

```html
<form data-next-checkout data-next-go="upsell.html">
  <input data-next-field="email" type="email" autocomplete="email" required />
  <p data-next-query="checkout.errors.email"></p>
  <input data-next-field="first_name" autocomplete="given-name" required />
  <input data-next-field="last_name" autocomplete="family-name" required />
  <div data-next-address="shipping"></div>
  <input data-next-field="phone" type="tel" autocomplete="tel" />

  <label><input data-next-field="billing_same_as_shipping" type="checkbox" checked /> Billing same as shipping</label>
  <div data-next-address="billing"></div>
  …
</form>
```

[data-next-address](../attribute-reference/widgets/data-next-address.md) draws the address for the
selected country: its fields, order, labels and postcode format. The country list is the
campaign's shipping countries. The billing address hides while `billing_same_as_shipping` is
ticked. The phone field gets the country's flag and mask.

As soon as the checkout has started and the shopper has a name and an email, the checkout saves
them as a lead (`user.created`), the cart that `cart.abandoned` follows up. `data-next-lead` changes
when; see [Checkout](../attribute-reference/objects/checkout.md).

## Payment

```html
<div data-next-payment></div>
<p data-next-query="checkout.errors.payment"></p>
<div data-next-express></div>
<button>Complete order</button>
```

[data-next-payment](../attribute-reference/widgets/data-next-payment.md) draws the methods the
campaign offers, with the card fields under the card; the card number and CVV are drawn by the
payment provider, so the page never sees the card.
[data-next-express](../attribute-reference/widgets/data-next-express.md) adds Apple Pay, Google Pay
and PayPal buttons, which place the order with the wallet's details.

## Multi-step checkout

Split the form across pages: a middle step has `data-next-step`, and its `data-next-go` is the
next step. Submitting a step checks its fields and opens the next page with the visit's
parameters; the last step has the payment and no `data-next-step`. A later step shows what was
entered with `checkout.*`:

```html
<form data-next-checkout data-next-step data-next-go="payment.html">…</form>

<!-- payment.html -->
<p>Ship to <span data-next-query="checkout.shipping_address"></span></p>
```

Events for each step are in the [Checkout lifecycle](../event-reference/checkout/lifecycle.md), and
for paying in the [Payments lifecycle](../event-reference/payments/lifecycle.md).
