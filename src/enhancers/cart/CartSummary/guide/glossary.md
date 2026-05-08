# Glossary

## Discount

A reduction applied to the cart total. Discounts come from two sources: offers (promotions configured on the campaign) and vouchers (coupon codes entered by the customer). `{totalDiscount}` in a summary template is the combined total from both sources. `{discounts}` is a deprecated alias for `{totalDiscount}` that is still rendered.

---

## Offer discount

A discount applied automatically by a campaign offer rule — for example, "buy 2 get 10% off". Offer discounts are listed individually in `data-summary-offer-discounts`.

---

## Voucher discount

A discount applied when a customer enters a coupon code. Voucher discounts are listed individually in `data-summary-voucher-discounts`.

---

## State class

A CSS class applied to the host element by the enhancer to reflect the current cart state (e.g., `next-has-discounts`, `next-free-shipping`). Use these in CSS selectors to show or hide rows without JavaScript. See [reference/attributes.md](./reference/attributes.md) for the full list.

---

## Summary line

One entry in the cart summary's line item list. A summary line corresponds to one package in the cart and includes pricing from both the API calculation (post-discount prices) and campaign data (display fields like name, image, and product name).

---

## Template token

A `{placeholder}` string inside a custom `<template>` that the enhancer replaces with a formatted value on each render. For example, `{subtotal}` is replaced with the formatted subtotal string (e.g., `$24.99`). Unrecognized tokens are left unchanged. Per-line tokens use the `{item.*}` namespace inside `data-summary-lines` row templates.
