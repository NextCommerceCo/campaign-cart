---
title: "Features/Order/Order Item List/Overview"
group: "Features"
category: "Order Item List"
---

# Order Item List

> Category: `order`
> Last reviewed: 2026-07-30
> Owner: Campaigns

Renders one row per line of a completed order, from a template you supply. It is
the receipt counterpart to the cart item list.

## Concept

You write one row as a template with `{token}` placeholders; the feature stamps it
out once per order line. The template lives in your markup, so the receipt matches
the campaign's design without the SDK generating any layout.

The catch worth knowing up front: **an order line is not a cart line.** The two
have different shapes, so a template written for the cart list will render empty
tokens here. The fields available are the order ones.

Because the order arrives asynchronously, the container carries its own state
classes — loading, has-items, empty, error. On a receipt page there is always a
moment with no rows, and an unstyled gap reads as a broken page.

## Business logic

- The order is loaded from the reference in the page URL, so a receipt page needs
  no extra wiring.
- The template is resolved from the first available of: `data-item-template-id`,
  `data-item-template-selector`, `data-item-template`, or the container's own
  `innerHTML`.
- The container's `innerHTML` is replaced when the order arrives. Anything you
  attach to a rendered row is destroyed — bind on the container instead.
- An order with no lines renders `data-empty-template`. In practice that state means
  the order failed to load rather than a genuinely empty purchase, so treat it as
  an error state in your copy.
- `order-error` is applied when the load fails. Without something visible on it, the
  visitor sees an empty receipt and no explanation.

## Decisions

- We render from a page template rather than generated markup, for the same reason
  as the cart list: a receipt is designed, and generated rows get overridden.
- We expose four state classes rather than only rendering rows, because the gap
  before the order arrives is a real UI state on every receipt page.
- We replace `innerHTML` wholesale rather than diffing rows, because an order is
  immutable once loaded — it renders once and does not change, so diffing would buy
  nothing.
- We kept the template resolution order identical to the cart item list, so the two
  behave the same way even though their fields differ.

## Limitations

- Does not group, sort, or filter lines. They render in the order the API returns.
- Does not update. An order does not change, so there is nothing to react to after
  the first render.
- Does not share tokens with the cart item list. Order fields, not cart fields.
- Does not show totals. Those are single values —
  [order-display](../../../display/order-display/guide/overview.md).

## Reference

- [Attributes](./reference/attributes.md) — template sources and state classes
- Field names:
  [order display paths](../../../display/order-display/guide/reference/display-paths.md)
