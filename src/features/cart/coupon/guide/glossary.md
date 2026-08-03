---
title: "Features/Cart/Coupon/Glossary"
group: "Features"
category: "Coupon"
---

# Glossary

The discount vocabulary used across this guide, and the mismatch that trips
newcomers up most: what the shopper calls a **coupon** is what the code and the
API call a **voucher**.

## Bundle voucher

A code that belongs to a bundle rather than to the shopper. It is declared on a
bundle card with `data-next-bundle-vouchers` and applied or removed automatically
as the shopper changes bundles. Bundle vouchers are the one kind this feature must
not touch — see
[`bundle-selector`](../../../cart/bundle-selector/guide/overview.md).

---

## Coupon card

The one piece of markup you author to show an applied code — a chip or row with
the code and a remove control. Marked `data-template`, it is hidden and cloned
once per applied code, so you design a single card and never write markup per
code. Its structure is in
[reference/attributes.md](./reference/attributes.md).

---

## Coupon code

The string a shopper types to get a discount, such as `SAVE10`. It is stored
upper-cased and trimmed, so `save10` and ` SAVE10 ` become the same code — which
matters when removing one, because removal is an exact match.

---

## Offer discount

A reduction the campaign gives on its own — a bundle price, a buy-more-save-more
tier, a promotion attached to the offer. Nobody types anything to get it; it
applies because of what is in the cart. Kept separate from a voucher discount so a
page can show "your bundle saving" and "your code" as different lines, via
`data-next-discounts="offer"` and `data-next-discounts="voucher"` on
[`cart-summary`](../../../cart/cart-summary/guide/overview.md).

---

## Voucher

What the SDK's state and the API call a coupon code. Cart and checkout state hold
a `vouchers` list, `next.getCoupons()` reads it, and the events are named
`coupon:*` — same thing throughout, two words for it. Expect to see "voucher" in
any state you inspect in the debug panel.

---

## Voucher discount

The money a shopper's code took off, as opposed to a discount the campaign applied
by itself. It is computed against the cart lines when the totals are recalculated,
which is why a code applied to an empty cart produces no voucher discount even
though the code is listed as applied.
