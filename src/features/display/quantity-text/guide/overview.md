---
title: "Features/Display/Quantity Text/Overview"
group: "Features"
category: "Quantity Text"
---

# Quantity Text

> Category: `display`
> Last reviewed: 2026-07-30
> Owner: Campaigns

Writes a sentence that mentions a live quantity — "3 bottles selected" — and
rewrites it whenever that quantity changes.

## Concept

This exists for the case a plain value binding handles badly: a number that has to
sit **inside** a sentence.

You could bind the number alone and write the words around it, but then the wording
cannot depend on the number's position or context, and you end up with three
elements to keep aligned. Here the whole sentence is the template, with `{qty}`
where the number goes.

Which quantity it follows is usually obvious from where the element sits — inside a
selector card or a cart row, the enclosing package is the subject. So the common case
needs no configuration at all; only a sentence placed away from its subject has to
name the selector.

## Business logic

- `data-next-quantity-text` is the template and is required. Empty or missing, the
  feature logs `QuantityTextEnhancer requires data-next-quantity-text attribute` and
  renders nothing.
- `{qty}` is substituted everywhere it appears; the rest of the string is
  written out verbatim. An unrecognised token is **not** an error — it is written out
  verbatim too, so a misspelled `{quantity}` reaches the visitor as literal text.
- The subject is resolved from the nearest enclosing element carrying
  `data-next-package-id`, which is why a sentence inside a card or row works
  unconfigured.
- `data-next-quantity-selector-id` names a selector explicitly, for a sentence that
  lives outside the thing it describes.
- Inside an upsell offer, the offer's quantity is used rather than a cart line's.

## Decisions

- We template the whole sentence rather than binding a bare number, so wording and
  number stay in one place and can be translated together.
- We infer the subject from the DOM because a quantity sentence is nearly always
  inside the thing it is about.
- We kept this separate from the display system rather than adding a template option
  to `data-next-display`, so the display attribute stays about values and formats.

## Limitations

- Does not pluralise. "1 bottles" is what you get unless you handle the wording
  yourself.
- Does not format the number — no grouping or currency. Use
  [`data-next-display`](../../display-core/guide/reference/attributes.md) for a
  formatted value.
- Supports only the quantity tokens — `{qty}`, arithmetic on it (`{qty*3}`), and
  `{singular|plural}`. No other fields, and no access to prices or names.
- Does not aggregate across packages. One sentence, one subject.

## Reference

- [Attributes](./reference/attributes.md) — the template and how the subject is
  resolved
