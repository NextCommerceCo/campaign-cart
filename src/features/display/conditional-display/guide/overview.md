---
title: "Features/Display/Conditional Display/Overview"
group: "Features"
category: "Conditional Display"
---

# Conditional Display

> Category: `display`
> Last reviewed: 2026-07-30
> Owner: Campaigns

Shows or hides an element based on something live — whether the cart is empty,
whether the total has passed a free-shipping threshold, whether a particular
package is in the cart. You write the condition in the markup; nothing else has to
listen for changes.

## Concept

Think of it as a declarative `if` that stays true over time. The element is not
hidden once at load — the condition is re-evaluated whenever the state it depends
on changes, so a "free shipping unlocked" banner appears the moment the cart
crosses the threshold and disappears if the visitor removes an item.

Conditions read from the same namespaced paths as
[`data-next-display`](../../display-core/guide/reference/attributes.md). That
symmetry is deliberate: anything you can *show*, you can *test*. If
`data-next-display="cart.total"` renders a number, `data-next-show="cart.total >
100"` tests it.

`data-next-show` and `data-next-hide` are two entry points to the same feature,
not a modifier and its inverse. Use whichever reads better —
`hide="cart.isEmpty"` is clearer than `show="!cart.isEmpty"`.

## Business logic

- Conditions are re-evaluated on every relevant state change, not polled.
- A condition that fails to parse is logged and **the element is left visible**, so
  a typo in a condition does not silently hide content a visitor needs.
- `selection.*` conditions need to know which selector they refer to. The feature
  walks up the DOM to find the nearest enclosing one, so an element inside a
  selector card needs no configuration; only an element outside one needs
  `data-next-selector-id`.
- Operators are `==`, `!=`, `>`, `>=`, `<`, `<=`, and `!`; conditions combine with
  `&&` and `||`.
- **Inside a cart-summary or bundle row template these attributes mean something
  different.** There they are evaluated by that template's renderer, per row,
  against the row's own data — this feature is not instantiated for them.

## Decisions

- We fail open on an unparseable condition, because a hidden element is a silent
  failure and a visible one is an obvious one.
- We share the display system's paths rather than inventing a condition language,
  so there is one vocabulary to learn instead of two.
- We infer the selector from the DOM rather than requiring an id everywhere,
  because the common case is a condition inside the thing it is about.
- We kept `show` and `hide` as separate attributes rather than one attribute with
  negation, because a negated condition is harder to read at a glance in markup.

## Limitations

- Does not animate. The element is shown or hidden outright; add your own
  transition if you need one.
- Does not support arbitrary JavaScript expressions — only the operators listed
  above over known paths.
- Does not evaluate conditions inside cart-summary or bundle row templates; that is
  the renderer's job and the available data differs.
- Does not work on profile state. The profile system (`ProfileManager`,
  `data-next-profile`, `data-next-show-if-profile`, `data-next-hide-if-profile`)
  was removed in SDK **0.4.6**. Those attributes are inert now: the element is not
  managed at all, so it renders exactly as authored. If a page relied on
  `data-next-show-if-profile` to hide something, that content is now **visible** —
  delete the element or give it a real condition. Nothing replaces the profile
  namespace.

## Reference

- [Attributes](./reference/attributes.md) — condition syntax and scoping
- The paths you can test:
  [display-core](../../display-core/guide/reference/attributes.md)
