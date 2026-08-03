---
title: "Features/Display/Shipping Display/Overview"
group: "Features"
category: "Shipping Display"
---

# Shipping Display

> Category: `display`
> Last reviewed: 2026-07-30
> Owner: Campaigns

Shows a shipping method's name and cost — what a row in a "choose your delivery"
list is made of, including telling the visitor when a method is free.

## Concept

The important distinction is **method versus cart**. This feature describes a
shipping method that *exists in the campaign*: what it is called, what it costs,
whether it is free. It says nothing about what the visitor is currently being
charged.

That is why a shipping options list works: each row carries a
`data-next-shipping-id`, and every binding inside the row resolves against that
id. One template, several rows, each describing a different method.

For what the visitor will actually pay — the selected method, with any shipping
discount applied — use `cart.shipping` instead. Mixing the two is the usual reason
a shipping total disagrees with the summary.

## Business logic

- `data-next-shipping-id` is read from the element or the nearest enclosing element
  that carries it, so a row needs it once rather than on every binding inside.
- Without an id in scope there is no method to resolve and the element renders
  empty — the usual reason a shipping price is blank.
- `isFree` is a computed property, not a price of zero: use it to swap in the word
  "Free" rather than rendering `$0.00`.
- `price` and `cost` are aliases for the same value.
- Selecting a method is not this feature's job. It describes options; the cart owns
  which one is chosen.

## Decisions

- We resolve the id from an ancestor so a list row can be a plain template with the
  id declared once, instead of repeating it on the name, the price, and the badge.
- We kept these paths describing the campaign's methods rather than the cart's
  selection, because a list has to show options the visitor has *not* chosen.
- We expose `isFree` separately from a zero cost, because "Free" and "$0.00" are
  different messages to a visitor even when the number matches.

## Limitations

- Does not select a shipping method or react to selection.
- Does not reflect shipping discounts. A discount applies to the cart, so it shows
  up in `cart.shipping`, not here.
- Does not filter by availability. Which methods to render is your markup's
  decision.
- Does not sort. Rows appear in the order you write them.

## Reference

- [Attributes](./reference/attributes.md) — scoping, and a worked options list
- [Display Paths](./reference/display-paths.md) — every `shipping.*` value
- Shared modifiers:
  [display-core](../../display-core/guide/reference/attributes.md)
