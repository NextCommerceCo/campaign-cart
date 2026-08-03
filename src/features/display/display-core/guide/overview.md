---
title: "Features/Display/Display Core/Overview"
group: "Features"
category: "Display Core"
---

# Display System

> Category: `display`
> Last reviewed: 2026-07-30
> Owner: Campaigns

Binds any element on the page to a live value — a cart total, a package price, an
order number — and keeps it formatted and current. This is the shared contract
behind every `data-next-display` binding, whatever it points at.

## Concept

One attribute does all of it. `data-next-display="cart.total"` says *show this
value here*, and the SDK works out the rest: which subsystem answers, how to format
the result, and when to re-render it.

The first segment is a **namespace**, and it decides who answers:

| Namespace | Resolves against |
|---|---|
| `cart.` / `cart-summary.` | The cart — totals, counts, shipping, discounts |
| `package.` / `campaign.` | A campaign package's own fields and prices |
| `selection.` | What a selector currently has selected |
| `order.` | A completed order, on receipt and upsell pages |
| `shipping.` | A shipping method's name and cost |
| `selector.` | One card inside a package selector |
| `bundle.` | A bundle selector's current bundle |
| `toggle.` | One package toggle's state and price |

Eight different features sit behind those namespaces, but you never choose between
them — the namespace does. That is why an unknown namespace is silent rather than an
error: no feature claims the element, so nothing happens to it.

The **modifiers** are the other half of the contract, and they are the same
everywhere. `data-next-format` overrides the inferred format; `data-hide-if-zero`
and `data-hide-if-false` remove an element rather than showing `$0.00` or `No`;
`data-multiply-by` and `data-divide-by` scale a value so a per-unit price can be
shown as a pack total without a second binding.

## Business logic

- Formatting is inferred by default. Money paths format as currency, booleans as
  yes/no — so `data-next-format` is only needed when the inference is wrong.
- `data-format` is accepted as an alias of `data-next-format`, for older markup.
- Hiding is genuine hiding, not blanking: a zero savings row disappears.
- `data-hide-zero-cents` renders `$49` for a whole amount while keeping cents where
  they exist.
- `data-format-debug` is written to the element when formatting could not produce a
  sensible result. Read it in devtools before assuming the value is wrong.
- Values are re-rendered on the underlying state change, not polled.

## Decisions

- We route on a namespace prefix rather than having a separate attribute per source,
  so there is one attribute to learn instead of eight.
- We infer formats rather than requiring them, because the common case — a price
  rendering as a price — should need no configuration.
- We hide rather than blank on zero and false, since an empty element collapses in
  layout while `$0.00` reads as a real charge.
- We put the arithmetic modifiers in markup rather than expecting a computed path for
  every combination, so "price ÷ 3" does not need its own field in the SDK.
- We fail silently on an unknown namespace. The alternative — throwing — would take
  down a page over a typo in a decorative binding.

## Limitations

- Does not write. Display bindings are read-only; use the cart operations to change
  anything.
- Does not compute across namespaces. There is no path that mixes a cart total with a
  package price.
- Does not template. For a value inside a sentence, use
  [quantity-text](../../quantity-text/guide/overview.md).
- Does not validate the path. A misspelled path renders nothing rather than warning,
  which is why the path tables per namespace are worth checking against.

## Reference

- [Attributes](./reference/attributes.md) — every modifier, and the namespace routing
  table
- Paths per namespace: [cart](../../../cart/cart-summary/guide/reference/display-paths.md),
  [package](../../product-display/guide/reference/display-paths.md),
  [selection](../../selection-display/guide/reference/display-paths.md),
  [order](../../order-display/guide/reference/display-paths.md),
  [shipping](../../shipping-display/guide/reference/display-paths.md)
- Testing a value instead of showing it:
  [conditional-display](../../conditional-display/guide/overview.md)
