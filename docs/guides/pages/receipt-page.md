---
title: "Building Pages/Receipt Page"
group: "Building Pages"
category: "Building Pages"
---

# Building a receipt page

The receipt confirms the order. The visitor arrives with `?ref_id=` in the URL (boot loads the completed order from it) and the page reads everything it shows from the `order.*` display namespace. No form, no cart, no `next_url`: this is the end of the funnel. The examples below are condensed from `receipt.html` in the `apollo` starter template ([campaign-cart-starter-templates](https://github.com/NextCommerceCo/campaign-cart-starter-templates)).

The head only needs the page type:

```html
<meta name="next-page-type" content="receipt">
```

## Loading state first, content after

The order takes a moment to load, so hide order-bearing sections until the SDK has real values. The SDK's gate is `data-next-await`: the SDK adds the `next-display-ready` class to `<html>` when its DOM scan finishes, and the shipped `next-core.css` keeps anything under `data-next-await` invisible until then:

```html
<div data-next-await="">
  <div>Confirmation #<span data-next-display="order.number">DQFDHG5E0</span></div>
  <h2>Thank you, <span data-next-display="order.customer.name">Taylor</span>!</h2>
</div>
```

The apollo template goes further and shows a full placeholder skeleton while the order loads, swapping it for the real content. That pattern lives in the template, not the SDK: its `data-next-skeleton` / `data-next-content` markers are the template's own, styled by its CSS (`_includes/receipt-skeleton.html`), so copy the include if you want it, but don't expect those two attributes to do anything on their own.

## Order fields

Every field on the confirmation is one `data-next-display` binding into the order. The paths the apollo receipt uses:

```html
<div data-next-display="order.customer.email">jordan.chen@domain.com</div>
<div data-next-display="order.shippingAddress.line1">151 O'Connor St</div>
<div data-next-display="order.shippingAddress.line2">Apt 1011</div>
<div><span data-next-display="order.shippingAddress.city">Ottawa</span>, <span data-next-display="order.shippingAddress.state">ON</span>, <span data-next-display="order.shippingAddress.postcode">K2P 2L8</span></div>
<div data-next-display="order.shippingAddress.country">Canada</div>
<div data-next-display="order.shippingMethod">FedEx Ground</div>
<div data-next-display="order.paymentMethod">Credit Card</div>
```

The same structure exists under `order.billingAddress.*`. The static text inside each element is a placeholder the SDK replaces; the templates use realistic values so the page previews sensibly before the SDK runs.

## Line items and totals

The purchased lines render from a named `<template>` that the order item list stamps once per line, using `{item.*}` tokens:

```html
<template id="order-item-template">
  <div>
    <img src="{item.image}" alt="{item.name}">
    <div>{item.quantity}x {item.name}</div>
    <div>{item.lineTotal}</div>
  </div>
</template>
<div data-item-template-id="order-item-template" data-next-order-items=""></div>
```

Totals are plain bindings, with the tax row shown only when the order has tax:

```html
<div data-next-display="order.subtotal"></div>
<div data-next-display="order.shipping"></div>
<div data-next-show="order.hasTax">
  <div data-next-display="order.tax"></div>
</div>
<div><span data-next-display="order.currency"></span><span data-next-display="order.total"></span></div>
```

## Cautions

- **The order is kept for 15 minutes.** The order store expires after that, so a bookmarked or re-opened receipt link eventually renders the skeleton with nothing to fill it. That is by design: the receipt is a confirmation, not an order-history page.
- **Do not use cart attributes on a receipt.** The cart is a different store from the order; `cart.*` bindings and quantity buttons on a receipt read whatever cart state is left over, not the completed order. (The apollo receipt itself still carries a leftover `data-next-quantity` pair inside its line template; treat that as legacy carryover, not a pattern to copy.) Read from `order.*` only.
