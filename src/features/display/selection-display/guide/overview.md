---
title: "Features/Display/Selection Display/Overview"
group: "Features"
category: "Selection Display"
---

# Selection Display

> Category: `display`
> Last reviewed: 2026-07-30
> Owner: Campaigns

Shows what the visitor has currently picked in a selector — its name, price, and
savings — before anything reaches the cart. This is what a "you selected the
3-pack, $49.99" line beside a set of options is made of.

## Concept

The SDK has three ways to ask about a price, and choosing the wrong one is the most
common reason a number never updates. They answer different questions:

| Namespace | Answers |
|---|---|
| `selection.*` | What has been **picked but not added** — a preview |
| `package.*` | A **fixed** package's own values, regardless of any selection |
| `cart.*` | What is **actually in the cart** |

This feature owns `selection.*`. It follows a selector's current choice, so its
values change as the visitor clicks between cards and vanish into nothing if there
is no selection yet.

Because a selection belongs to a *particular* selector, every binding has to know
which one. Rather than requiring that everywhere, the feature walks up the DOM: an
element inside a selector follows that selector automatically. Only an element
elsewhere on the page — a sticky summary bar, say — has to name it.

## Business logic

- Values track the selector's live selection, including changes made
  programmatically or by cart sync on load, not only visitor clicks.
- The selector is resolved in this order: an explicit `data-next-selector-id`, then
  the nearest enclosing selector, then an enclosing cart selector's
  `data-next-id`.
- Quantity comes from the selected card, so a price reflects the quantity the
  visitor chose rather than a single unit.
- With no selection, the paths have nothing to resolve and the elements render
  empty. Pair them with a `data-next-show="selection.hasSelection"` wrapper if an
  empty preview looks broken.
- Formatting and hiding modifiers are the shared display ones — this feature adds
  no formatting of its own.

## Decisions

- We infer the selector from the DOM because the overwhelming case is a preview
  sitting inside or beside the selector it describes; requiring an id everywhere
  would be noise.
- We kept `selection.*` separate from `package.*` rather than making one namespace
  "smart", because a page often needs both at once — a fixed price to compare
  against, and the live one.
- We expose `hasSelection` as a path so the empty state is something you can style,
  rather than the feature guessing what to render.

## Limitations

- Does not show anything before a selection exists.
- Does not aggregate across selectors. One binding follows one selector.
- Does not know about the cart. A package can be selected and not in the cart, or
  in the cart and not selected — use `cart.*` for what will be charged.
- Does not cover bundles. A bundle selector's current bundle is `bundle.*`, on
  [bundle-selector](../../../cart/bundle-selector/guide/reference/attributes.md).

## Reference

- [Attributes](./reference/attributes.md) — scoping and the namespace comparison
- [Display Paths](./reference/display-paths.md) — every `selection.*` value
- Shared modifiers:
  [display-core](../../display-core/guide/reference/attributes.md)
