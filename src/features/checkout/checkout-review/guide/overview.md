---
title: "Features/Checkout/Checkout Review/Overview"
group: "Features"
category: "Checkout Review"
---

# Checkout Review

> Category: `checkout`
> Last reviewed: 2026-07-30
> Owner: Campaigns

Plays back what the visitor has entered — address, contact details, chosen payment
method — so they can check it before paying.

## Concept

A review section is not a second form. It is a read-only mirror of the one the
visitor already filled in: each slot names a checkout field, and its value is
written back as they type.

That live echo is the point. A separate "review step" that only updates on
navigation goes stale the moment someone edits a field, and a stale review is worse
than none — it shows the visitor something they are not about to buy.

## Business logic

- Each slot names a field with `data-next-checkout-review`, using the same names as
  the form's `data-next-checkout-field` values.
- A name with no matching field renders its fallback forever. That is the usual
  reason a review row appears stuck on its placeholder.
- `data-next-format` controls presentation — a phone number or a card expiry
  formatted for reading, rather than the raw input echoed back.
- `data-next-fallback` is what shows while a field is still blank. Without one an
  unfilled field renders as nothing, which reads as a broken layout rather than an
  empty value.
- The review is display-only. It never writes to the form or the order.

## Decisions

- We mirror live rather than snapshotting at a step boundary, so the review cannot
  disagree with the form.
- We reuse the form's field names instead of inventing review keys, so there is one
  vocabulary and a review slot can be matched to its input by reading the markup.
- We require an explicit fallback rather than inventing placeholder text, because
  the right wording for "not filled in yet" depends on the campaign's voice.
- We kept it read-only. A review that could edit would need its own validation, and
  then there would be two places for a field's rules to live.

## Limitations

- Does not validate. It shows what is there, including invalid values.
- Does not let the visitor edit in place — link them back to the field instead.
- Does not show card details beyond the payment method, since the card number never
  exists in page state to echo.
- Does not summarise the cart. Line items and totals come from
  [cart-summary](../../../cart/cart-summary/guide/reference/attributes.md).

## Reference

- [Attributes](./reference/attributes.md) — slots, formats, fallbacks
- Field names:
  [checkout-form](../../checkout-form/guide/reference/attributes.md)
