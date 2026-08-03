---
title: "Features/Display/Selection Display/Use Cases"
group: "Features"
category: "Selection Display"
---

# Use Cases

Situations where the page has to reflect what the visitor has **picked** in a
selector, before anything has been added to the cart.

## A live preview beside a set of options

> Effort: lightweight

**When:** A page offers 1-pack / 3-pack / 6-pack cards, and a line underneath should
confirm the current choice — "You picked the 3-pack, $49.99" — updating as the
visitor clicks between cards.

**Why this enhancer:** `selection.*` follows the selector's live choice, and a
binding placed inside the selector finds it without being told which one:

```html
<div data-next-package-selector data-next-selector-id="main">
  <!-- the selector cards -->
  <p>
    You picked <span data-next-display="selection.name">—</span>
    for <span data-next-display="selection.total">—</span>
  </p>
</div>
```

**Watch out for:** With nothing selected yet, these paths have nothing to resolve and
the elements render empty — which looks like a broken line rather than an absent one.
Wrap the preview in
`data-next-show="selection.hasSelection"` (see
[conditional-display](../../../display/conditional-display/guide/overview.md)) so the
whole line is absent until there is a choice.

---

## A sticky bar that summarises the choice

> Effort: lightweight

**When:** On a long page, a bar pinned to the bottom of the viewport repeats the
current pick and the add-to-cart button, so the visitor never has to scroll back to
the options.

**Why this enhancer:** Naming the selector detaches the summary from the selector's
position in the markup:

```html
<div class="sticky-bar" data-next-selector-id="main">
  <span data-next-display="selection.name">—</span>
  <span data-next-display="selection.total">—</span>
  <button data-next-action="add-to-cart">Add to cart</button>
</div>
```

**Watch out for:** A `selection.*` binding placed outside every selector **and**
without `data-next-selector-id` logs
`No selector ID found for SelectionDisplayEnhancer` and renders nothing. Putting the
id once on the bar, as above, covers every binding inside it.

---

## A savings badge on the current pick

> Effort: lightweight

**When:** The pack cards should sell the upgrade — "Save 33% versus buying singles" —
with the percentage following whichever pack is selected.

**Why this enhancer:** The savings against the compare-at price are computed for the
current selection, and `hasSavings` lets the badge disappear entirely on a pack that
has none:

```html
<span data-next-display="selection.savingsPercentage"
      data-hide-if-zero="true">0%</span>
<span data-next-display="selection.hasSavings" data-hide-if-false="true">
  You are saving
</span>
```

**Watch out for:** These savings are measured against the package's compare-at price
(`selection.compareTotal`), not against a coupon or an offer discount. A visitor with
a coupon will see a larger reduction in the cart than this badge advertises, which
reads as an inconsistency — put coupon savings on the cart summary instead.

---

## Per-unit pricing on a multi-pack

> Effort: lightweight

**When:** The 6-pack should advertise "$8.33 per bottle" to make the larger pack look
like the better value.

**Why this enhancer:** The unit price is derived from the selected package's quantity,
so it changes with the pick and needs no arithmetic in the markup:

```html
Only <span data-next-display="selection.unitPrice">—</span> per bottle
```

**Watch out for:** The quantity comes from the selected card. A card whose
`data-next-quantity` does not match the number of units it advertises produces a
per-unit price that disagrees with the copy — check the card's quantity before
blaming the calculation.

---

## When NOT to use this

### What the visitor will actually be charged

**Why not:** A selection is a preview. A package can be selected and never added, or
sit in the cart while a different card is highlighted, so `selection.total` and the
cart total legitimately disagree.

**Use instead:**
[`cart-summary`](../../../cart/cart-summary/guide/overview.md) — the `cart.*`
namespace, which reflects the real cart including coupons and shipping.

### A fixed package's own price

**Why not:** These paths follow a selection, so they change under you. A "compare
our plans" table needs each column pinned to one package regardless of what is
selected.

**Use instead:**
[`product-display`](../../../display/product-display/guide/overview.md) — `package.*`
paths, optionally with an explicit id such as `package.101.price`.

### A bundle selector's current bundle

**Why not:** `selection.*` describes a package selector's choice. A bundle is a
different shape and a different namespace.

**Use instead:**
[`bundle-selector`](../../../cart/bundle-selector/guide/overview.md) — the `bundle.*`
namespace.
