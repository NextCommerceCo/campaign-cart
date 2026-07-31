---
title: "Features/Display/Display Core/Use Cases"
group: "Features"
category: "Display Core"
---

# Use Cases

Situations where a number or a piece of text on the page has to match live SDK state
and keep matching it, with no JavaScript of your own.

## A cart total that stays current everywhere it appears

> Effort: lightweight

**When:** The header badge, the drawer, and the sticky footer all show the cart
total, and all three have to change the instant an item is added or removed.

**Why this enhancer:** Each is one attribute, and each re-renders off the same state
change. Repeating the binding costs nothing — there is no wiring to duplicate:

```html
<span data-next-display="cart.total"></span>
<span data-next-display="cart.quantity"></span>
```

**Watch out for:** An unrecognised namespace is **silent**. No feature claims the
element, nothing throws, and the element keeps whatever text you authored. So a
binding that never updates usually means a typo in the first segment — check it
against the namespace table in [reference/attributes.md](./reference/attributes.md).

---

## A savings row that disappears instead of reading "$0.00"

> Effort: lightweight

**When:** The order summary has a discount line that must not be visible when there
is no discount, because `$0.00` reads to a visitor like a real charge.

**Why this enhancer:** `data-hide-if-zero` removes the element rather than blanking
it, so the row collapses out of the layout:

```html
<div class="summary-row">
  <span>Discount</span>
  <span data-next-display="cart.totalDiscount" data-hide-if-zero="true"></span>
</div>
```

**Watch out for:** The value has to be the literal string `true`. The SDK compares
`data-hide-if-zero === 'true'`, so `data-hide-if-zero="1"` or a bare
`data-hide-if-zero` is ignored and the zero row stays on screen. The same holds for
`data-hide-if-false` and `data-hide-zero-cents`.

---

## "Only $16.66 per bottle" from a pack price

> Effort: lightweight

**When:** A 3-pack is priced as a pack, but the card should also advertise the
per-unit price to make the pack look like the better deal.

**Why this enhancer:** `data-divide-by` does the arithmetic in the markup, so the
SDK does not need a stored field for every combination a page might want:

```html
<span data-next-display="package.101.price"></span> for 3 —
<span data-next-display="package.101.price" data-divide-by="3"></span> each
```

**Watch out for:** When the rendered result looks wrong, the element carries a
`data-format-debug` attribute holding a JSON snapshot of how the value was resolved
and formatted. Read that in devtools before assuming the underlying value is bad —
it is written precisely when formatting could not produce a sensible result.

---

## Values inside cart item list rows

> Effort: moderate

**When:** Each rendered cart line needs its own price or name, resolved from the row
rather than named explicitly.

**Why this enhancer:** Context attributes on an ancestor tell a binding which thing
it is about, so one row template serves every line.

**Watch out for:** `data-next-cart-item-id` is the context attribute this feature
reads, but the cart item list renders its rows with `data-cart-item-id` — **without
the `next` segment** — so that context does not resolve inside those rows. The
symptom is an empty binding in every row. Use `data-next-package-id`, which the same
rows do carry, until the two names agree.

---

## When NOT to use this

### A number that has to sit inside a sentence

**Why not:** A binding replaces the element's whole text, so "get {number} free"
needs three elements to keep aligned and cannot be translated as one string.

**Use instead:**
[`quantity-text`](../../../display/quantity-text/guide/overview.md) — the whole
sentence is the template, with tokens where the numbers go.

### Deciding whether an element appears at all

**Why not:** `data-hide-if-zero` and `data-hide-if-false` only react to the bound
value being zero or false. They cannot express "show this when the cart total passes
$50".

**Use instead:**
[`conditional-display`](../../../display/conditional-display/guide/overview.md) —
`data-next-show` and `data-next-hide` take a condition over the same paths.

### Changing anything

**Why not:** Display bindings are read-only. Writing a new value into the element's
text does not write to the cart.

**Use instead:**
[`add-to-cart`](../../../cart/add-to-cart/guide/overview.md) and the other cart
features, which own the operations that change state.
