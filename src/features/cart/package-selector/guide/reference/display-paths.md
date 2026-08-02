---
title: "Features/Cart/Package Selector/Display Paths"
group: "Features"
category: "Package Selector"
---

# Display Paths

<!-- Hand-written. The `selector.` paths are resolved inside
     package-selector.display.ts › PackageSelectorDisplayEnhancer.getPropertyValue,
     not by the PROPERTY_MAPPINGS routing table, so there is nothing to generate
     this page from. Update it in the same change as that method or its FORMAT_MAP. -->

Every value the `selector.` namespace can show. Write it as
`data-next-display="selector.{selectorId}.{packageId}.{path}"`, where `{selectorId}`
is the container's `data-next-selector-id` and `{packageId}` is a card's
`data-next-package-id`. The element does not have to sit inside the card, or inside
the container.

```html
<span data-next-display="selector.main.101.price"></span>
<span data-next-display="selector.main.101.savings" data-hide-if-zero="true"></span>
```

The Format column is what you get with no `data-next-format`; set that attribute to
override it. Formatting and hiding modifiers are the same for every namespace — see
[display-core](../../../../display/display-core/guide/reference/attributes.md).

| Path | Format | Notes |
|---|---|---|
| `selector.{selectorId}.{packageId}.isSelected` | `boolean` | The card the visitor has picked. Reads the card's own `data-next-selected`, so it tracks the selection, not the cart. |
| `selector.{selectorId}.{packageId}.isInCart` | `boolean` | The card's package is in the cart — including when it got there as a swap of another package. |
| `selector.{selectorId}.{packageId}.price` | `currency` | Card total at its current quantity. |
| `selector.{selectorId}.{packageId}.compare` | `currency` | Retail / compare-at total. Empty when the package has no `price_retail`. |
| `selector.{selectorId}.{packageId}.savings` | `currency` | Compare price minus the card's subtotal. |
| `selector.{selectorId}.{packageId}.savingsPercentage` | `percentage` | `savings ÷ compare × 100`, on a 0–100 scale. |
| `selector.{selectorId}.{packageId}.hasSavings` | `boolean` | `savings > 0`. Pair with `data-hide-if-false` to hide a whole savings block. |

The four money paths read the raw numbers the selector writes onto the card
(`data-package-price-total`, `-compare`, `-savings`, `-savings-pct` — see
[attributes.md](./attributes.md)), so they carry the price the API returned, not a
re-parse of formatted text.

## Cautions

- **A money path renders nothing until the card's price fetch lands.** The card
  dispatches a `selector:price-updated` DOM event when the numbers arrive — a browser
  event on the element, not one of the SDK events in [events.md](./events.md) — and
  the binding fills in then. Before that the element shows its markup fallback, so put
  the wanted placeholder inside it rather than expecting a `0`.
- **Zero reads as "no value".** `price`, `compare` and `savings` resolve through
  `parseFloat(...) || undefined`, so a genuine `0` is indistinguishable from a
  missing attribute and the element stays empty. For a free package, show the wording
  with [conditional display](../../../../display/conditional-display/guide/overview.md)
  instead of relying on this path to print `0.00`.
- **A path that names no live card stays silent.** A `{selectorId}` or `{packageId}`
  that matches no `[data-next-selector-card]` leaves the element untouched with no
  error — check both values against the markup when a binding never fills in.
- **An unrecognised property logs and stops.** Anything outside the table above
  produces `Unknown selector display property: "{property}"` at warn level; see
  [logs.md](./logs.md).
