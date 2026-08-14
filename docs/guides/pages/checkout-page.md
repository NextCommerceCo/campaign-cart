---
title: "Building Pages/Checkout Page"
group: "Building Pages"
category: "Building Pages"
---

# Building a checkout page

A checkout page is one `<form>` that the SDK turns into a working checkout: package selection, customer fields, an order bump, hosted card fields, express payment buttons, and a live order summary. The SDK prices everything, validates the fields, creates the order, and sends the visitor to the next page. Every example below is condensed from `checkout.html` in the `apollo` starter template ([campaign-cart-starter-templates](https://github.com/NextCommerceCo/campaign-cart-starter-templates)).

The page declares itself in the head. See [Getting started](../start-here/getting-started.md) for the full boot setup:

```html
<meta name="next-page-type" content="checkout">
<meta name="next-success-url" content="/upsell-1/">
```

Everything else lives inside the form root:

```html
<form data-next-checkout="form" method="post"></form>
```

## Package selection

The bundle selector presents the offer tiers as clickable cards. Each card declares its cart contents as JSON; clicking a card swaps the whole cart to that tier.

```html
<div
  data-next-bundle-selector
  data-next-selector-id="drone-packages"
  data-next-selection-mode="swap"
  data-next-include-shipping="true"
  data-next-await=""
>
  <div
    data-next-bundle-card
    data-next-bundle-id="drone-qty-1"
    data-next-shipping-id="2"
    data-next-bundle-items='[{"packageId":1,"quantity":1}]'
    data-next-selected="true"
    role="button"
  >
    <img data-next-display="package.image" alt="">
    <div>1x <span data-next-display="package.name">Package Title</span></div>
    <div data-next-bundle-display="hasDiscount">
      SAVE <span data-next-bundle-display="discountPercentage">-</span>
    </div>
    <span data-next-bundle-display="originalUnitPrice">-</span>
    <span data-next-bundle-display="unitPrice">-</span>/ea
    <span data-next-bundle-display="originalPrice">-</span>
    <span data-next-bundle-display="price">-</span>
  </div>
  <div
    data-next-bundle-card
    data-next-bundle-id="drone-qty-2"
    data-next-shipping-id="2"
    data-next-bundle-items='[{"packageId":1,"quantity":2}]'
    role="button"
  >
    <div>2x <span data-next-display="package.name">Package Title</span></div>
    <span data-next-bundle-display="price">-</span>
  </div>
</div>
```

The pieces that matter:

- `data-next-bundle-items`: the tier's cart lines, as JSON.
- `data-next-selected="true"`: the pre-selected default tier.
- `data-next-selection-mode="swap"`: picking a tier replaces the previous one.
- `data-next-shipping-id`: a per-tier shipping method; with `data-next-include-shipping="true"` the card price includes it.
- `data-next-bundle-display`: that card's calculated prices.
- `data-next-await`: the template's loading gate. The SDK adds the `next-display-ready` class to `<html>` when its DOM scan finishes, and the template's `next-core.css` keeps anything under `data-next-await` invisible until then, so the visitor never sees `-` placeholders flash. The SDK only sets the class; without that stylesheet the attribute does nothing.

## Customer and shipping fields

You write ordinary inputs and name each one with `data-next-checkout-field`. The SDK finds them by name; layout, order, and styling are yours.

```html
<div data-next-component="shipping-form">
  <input
    data-next-checkout-field="fname"
    autocomplete="given-name"
    placeholder="First Name*"
    type="text">
  <input
    data-next-checkout-field="lname"
    autocomplete="family-name"
    placeholder="Last Name*"
    type="text">
  <input
    data-next-checkout-field="email"
    autocomplete="email"
    placeholder="Email*"
    type="email">
  <input
    data-next-checkout-field="phone"
    autocomplete="tel-full"
    placeholder="Phone"
    type="tel">
  <select data-next-checkout-field="country" autocomplete="country-name">
    <option value="">Select Country</option>
  </select>
  <input
    data-next-checkout-field="address1"
    autocomplete="address-line1"
    placeholder="Address*">
  <input
    data-next-checkout-field="address2"
    autocomplete="address-line2"
    placeholder="Apartment, suite, etc. (optional)">
  <div data-next-component="location" class="next-hidden">
    <input
      data-next-checkout-field="city"
      autocomplete="address-level2"
      placeholder="City*">
    <select data-next-checkout-field="province" autocomplete="address-level1">
      <option value="">Select State</option>
    </select>
    <input
      data-next-checkout-field="postal"
      autocomplete="postal-code"
      placeholder="ZIP Code*">
  </div>
</div>
```

Two of these are SDK-managed containers, not fields. The country and state `<select>`s start with one empty option, and the SDK fills them from the campaign's country list. The city/state/postal group sits inside `data-next-component="location"` with `class="next-hidden"`: the SDK reveals it the moment the street address (`address1`) has a value (typed, autofilled, or autocompleted) and never hides it again (`location-field-visibility.ts`). The trigger is not configurable; omit the `location` wrapper to keep the fields visible from the start.

## Order bump

An order bump is a checkbox card that adds a second package to the order when toggled. From `_includes/bump-check01.html`:

```html
<div data-next-package-toggle data-next-await="">
  <div
    data-next-toggle-card
    data-next-is-upsell="true"
    data-next-package-sync="1"
    data-next-package-id="7"
  >
    <div>Get Extended Warranty</div>
    <span data-next-toggle-display="originalUnitPrice">--</span>
    <span data-next-toggle-display="unitPrice">--</span>/ea
    <img data-next-toggle-image alt="">
  </div>
</div>
```

`data-next-package-sync="1"` keeps the bump's quantity equal to the cart quantity of package 1. `data-next-toggle-display` accepts per-unit tokens (`unitPrice`, stable across tiers) or line totals (`price`, which scales with the synced quantity). Pick one pricing style per card.

## Payment

Payment methods are declared as radio sections. The card fields are the deliberate exception to "you write the inputs": `cc-number` and `cvv` are empty `<div>`s, and the SDK mounts hosted payment fields into them, so no card number ever passes through your page. From `_includes/payment-methods.html`:

```html
<div data-next-payment-method="credit">
  <input type="radio" name="payment_method" value="credit" checked>
  <div data-next-payment-form="credit">
    <div data-next-component="credit-error">
      <div data-next-component="credit-error-text">Error message</div>
    </div>
    <div data-next-checkout-field="cc-number"></div>
    <select data-next-checkout-field="exp-month">
      <option value="">Exp. Month</option>
    </select>
    <select data-next-checkout-field="exp-year">
      <option value="">Exp. Year</option>
    </select>
    <div data-next-checkout-field="cvv"></div>
  </div>
</div>
```

The starter templates ship the same pair for `paypal`, `klarna`, `apple-pay`, and `google-pay`: each `data-next-payment-method` section with a matching `data-next-payment-form` and its own `*-error` / `*-error-text` slots.

Express checkout is two containers; the SDK injects the wallet buttons into the second, in the order configured by `paymentConfig.expressCheckout` in your `config.js`:

```html
<div data-next-express-checkout="container">
  <div data-next-component="express-error">
    <div data-next-component="express-error-text">Error message</div>
  </div>
  <div data-next-express-checkout="buttons"></div>
</div>
```

## Order preview

The live summary renders the cart from a `<template>` using `{item.*}` tokens, with per-discount rows below it. Condensed from `_includes/cart-summary01.html`:

```html
<div data-next-cart-summary>
  <template>
    <div data-summary-lines>
      <template>
        <div data-package-id="{item.packageId}">
          {item.quantity}x {item.name}
          <span class="{item.hasDiscount}">{item.originalPrice}</span>
          <span>{item.price}</span>
        </div>
      </template>
    </div>
    <div>Subtotal {subtotal}</div>
    <ul data-next-discounts="voucher">
      <template>
        <li>{discount.name} −{discount.amount}</li>
      </template>
    </ul>
    <div>Shipping {shipping}</div>
    <div>Grand Total: {currency}{total}</div>
  </template>
</div>
```

## Create order

The submit button is a plain `type="submit"` button inside the form. No `data-next-*` attribute is needed. On submit the SDK validates, tokenizes payment, creates the order once, then sends the visitor to `next-success-url` with `?ref_id=` appended so the next page can load the order (`checkout-form.enhancer.ts › CheckoutFormEnhancer`).

## Debugging

Open the page with `?debugger=true`. The Checkout panel lists every field the SDK matched, its validation state, and the raw data it will send, so a field that never reaches the order shows up before you submit. The Cart and Campaign panels confirm prices loaded. See [Debugger](../reference/debugger.md).

Opening the debugger also puts the page in test mode, so pay with a test card while it is on.

## Cautions

- **The card field `<div>`s must stay empty.** The SDK mounts hosted fields into them; putting an `<input>` there means two competing fields and a checkout that cannot tokenize. Leave them as empty elements with the `data-next-checkout-field` name.
- **An unrecognised field name is silently not part of the order.** The names are fixed (`fname`, not `firstName`; `postal`, not `zip`). If a value the visitor typed never reaches the order, check the spelling against the field names in this guide's examples.
- **Wrap price-bearing sections in `data-next-await`.** Without it the visitor sees placeholder dashes until campaign prices load. The hiding is done by the template's `next-core.css`, keyed on the `next-display-ready` class the SDK adds to `<html>`. Keep that stylesheet on the page or the attribute does nothing.
