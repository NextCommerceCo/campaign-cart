---
title: "Features/Cart/Bundle Selector/Display Paths"
group: "Features"
category: "Bundle Selector"
---

# Display Paths

<!-- Hand-written. The `bundle.` paths are resolved inside
     bundle-selector.display.ts › BundleDisplayEnhancer.getPropertyValue, not by the
     PROPERTY_MAPPINGS routing table, so there is nothing to generate this page from.
     Update it in the same change as that method or its FORMAT_MAP. -->

Every value the `bundle.` namespace can show. Write it as
`data-next-display="bundle.{bundleId}.{path}"`, where `{bundleId}` is a card's
`data-next-bundle-id`. The element does not have to sit inside the card, or inside
the selector container.

```html
<span data-next-display="bundle.starter.price"></span>
<span data-next-display="bundle.starter.discountAmount" data-hide-if-zero="true"></span>
```

The Format column is what you get with no `data-next-format`; set that attribute to
override it. Formatting and hiding modifiers are the same for every namespace — see
[display-core](../../../../display/display-core/guide/reference/attributes.md).

| Path | Format | Notes |
|---|---|---|
| `bundle.{bundleId}.isSelected` | `boolean` | This card is the selector's current choice. |
| `bundle.{bundleId}.name` | `text` | The card's `data-next-bundle-name`. |
| `bundle.{bundleId}.price` | `currency` | Bundle total after every discount, for the card's current quantity multiplier. |
| `bundle.{bundleId}.originalPrice` | `currency` | Retail / compare-at total, before discounts. |
| `bundle.{bundleId}.discountAmount` | `currency` | Total discount the pricing API applied to the bundle. |
| `bundle.{bundleId}.discountPercentage` | `percentage` | The discount as a share of `originalPrice`, on a 0–100 scale. |
| `bundle.{bundleId}.hasDiscount` | `boolean` | `discountAmount > 0`. Pair with `data-hide-if-false` to hide a whole savings block. |
| `bundle.{bundleId}.unitPrice` | `currency` | `price ÷ (visible slot units × bundle quantity)` — the real per-unit price at the card's current multiplier. |
| `bundle.{bundleId}.originalUnitPrice` | `currency` | The same division applied to `originalPrice`. |
| `bundle.{bundleId}.currency` | `text` | ISO 4217 code the price fetch returned, e.g. `USD`. |

Everything but `isSelected` and `name` comes from the card's price summary, which the
selector fills in from the pricing API — so these are the same numbers the cart will
charge, not a re-parse of formatted text.

## Cautions

- **`compare`, `savings`, `savingsPercentage` and `hasSavings` do not work here.**
  They are accepted by `data-next-bundle-display` on a slot *inside* a card, which is
  a different mechanism, and a page that uses them in a `bundle.` path gets an empty
  element plus `Unknown bundle display property: "{property}"` at warn level. Use
  `originalPrice`, `discountAmount`, `discountPercentage` and `hasDiscount` in this
  namespace. See [attributes.md](./attributes.md) for the in-card form.
- **A path renders nothing until the card's price fetch lands.** Values arrive with
  the `bundle:price-updated` event ([events.md](./events.md)), so an element bound
  before that shows its markup fallback.
- **`{bundleId}` falls back to the selector id.** If no card carries that
  `data-next-bundle-id`, the value is taken from the *currently selected* card of a
  selector whose `data-next-selector-id` matches instead. That is deliberate — it is
  how a sticky bar shows "whatever is selected" — but it also means a typo'd bundle id
  can silently show another card's price. Bind to the card id when you mean one card.
- **An unrecognised property logs and stops** — same warn line as above; see
  [logs.md](./logs.md).
