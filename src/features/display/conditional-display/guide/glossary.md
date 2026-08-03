---
title: "Features/Display/Conditional Display/Glossary"
group: "Features"
category: "Conditional Display"
---

# Glossary

Terms used in this feature's guide that mean something specific here.

## Condition

The text you put in `data-next-show` or `data-next-hide` — a path, optionally
compared to a value, for example `cart.total > 50` or `param.preview`. It is a
question about the current state of the page, not a piece of JavaScript: only the
operators `==`, `!=`, `>`, `>=`, `<`, `<=`, `!`, `&&`, and `||` are understood, over
paths the SDK already knows.

---

## Display path

The dotted name of a value, such as `cart.total` or `selection.hasSelection`. The
same paths that [`display-core`](../../../display/display-core/guide/overview.md)
renders with `data-next-display` are the paths a condition can test — which is why
"anything you can show, you can test" holds.

---

## Namespace

The first segment of a path, which decides what part of the SDK answers the
question — `cart.`, `selection.`, `package.`, `order.`, `shipping.`, or `param.`.
Choosing the wrong namespace is the usual reason a condition never becomes true.

---

## Row template

The markup a cart summary or bundle selector repeats once per line. Inside one,
`data-next-show` and `data-next-hide` belong to that template's renderer and are
evaluated against a single row's data — this feature never runs there.

---

## Selector context

Which package selector a `selection.*` condition is asking about. It is taken from
`data-next-selector-id` on the element, or failing that from the nearest enclosing
selector in the markup. An element outside every selector has no selector context
and its `selection.*` condition cannot resolve.

---

## URL parameter condition

A condition in the `param.` namespace that tests a query parameter from the page
URL — `data-next-show="param.preview"` for `?preview=1`. A bare `param.name` with
no operator is a presence check. `params.` is accepted as an alias.
