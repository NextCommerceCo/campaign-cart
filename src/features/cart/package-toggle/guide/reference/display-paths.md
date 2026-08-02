---
title: "Features/Cart/Package Toggle/Display Paths"
group: "Features"
category: "Package Toggle"
---

# Display Paths

<!-- Generated from the enhancer that resolves this namespace, plus the
     feature manifest. Do not edit by hand: change getPropertyValue or
     <feature>.manifest.ts, then run `npm run docs:reference`. -->

Every value the `toggle.` namespace can show. Write it as `data-next-display="toggle.{packageId}.{path}"`, where `{packageId}` is a card's `data-next-package-id`. The element does not have to sit inside the card, or inside the container.

```html
<span data-next-display="toggle.101.price"></span>
<span data-next-display="toggle.101.discountAmount" data-hide-if-zero="true"></span>
```

The Format column is what you get with no `data-next-format`; set that attribute to override it. Formatting and hiding modifiers are the same for every namespace — see [display-core](../../../../display/display-core/guide/reference/attributes.md).

## Identity

| Path | Format | Notes |
|---|---|---|
| `toggle.{packageId}.packageId` | auto | The package `ref_id` the card is bound to. |
| `toggle.{packageId}.name` | `text` | Package display name from the campaign. |
| `toggle.{packageId}.image` | `text` | Package image URL. Renders as text — to set an `<img src>`, use the in-card `data-next-toggle-display="image"` form instead ([attributes.md](./attributes.md)). |
| `toggle.{packageId}.quantity` | auto | Units this card adds to the cart. |
| `toggle.{packageId}.productId` | auto | Product the package belongs to. Empty when the campaign does not carry one. |
| `toggle.{packageId}.variantId` | auto | Product variant. Empty when the package is not a variant. |
| `toggle.{packageId}.variantName` | `text` | Variant display name, e.g. `Large`. |
| `toggle.{packageId}.productName` | `text` | Product display name. |
| `toggle.{packageId}.sku` | `text` | Product SKU. Empty when the product has none. |
| `toggle.{packageId}.isSelected` | `boolean` | The package is in the cart right now. Unlike the in-card `data-next-toggle-display="isSelected"`, this tracks live cart state. |

## Price

| Path | Format | Notes |
|---|---|---|
| `toggle.{packageId}.price` | `currency` | Total for the card's quantity, after discounts. |
| `toggle.{packageId}.originalPrice` | `currency` | The same total before discounts. |
| `toggle.{packageId}.unitPrice` | `currency` | What one unit costs after discounts. |
| `toggle.{packageId}.originalUnitPrice` | `currency` | What one unit costs before discounts. |
| `toggle.{packageId}.discountAmount` | `currency` | Total discount on the line. `0` when there is none. |
| `toggle.{packageId}.discountPercentage` | `percentage` | `discountAmount ÷ originalPrice × 100`, on a 0–100 scale. |
| `toggle.{packageId}.hasDiscount` | `boolean` | `discountAmount > 0`. Pair with `data-hide-if-false` to hide a whole savings block. |
| `toggle.{packageId}.currency` | `text` | ISO 4217 code for the prices above, e.g. `USD`. |

## Subscription

| Path | Format | Notes |
|---|---|---|
| `toggle.{packageId}.isRecurring` | `boolean` | The package bills on a schedule rather than once. |
| `toggle.{packageId}.interval` | `text` | Billing interval: `day` or `month`. Empty on a one-time package. |
| `toggle.{packageId}.intervalCount` | auto | Intervals between charges — `3` with `interval: month` is quarterly. |
| `toggle.{packageId}.frequency` | `text` | The cadence in words: `Per month`, `Every 3 months`, `One time`. |
| `toggle.{packageId}.recurringPrice` | `currency` | What each later charge costs, for the card's quantity. |
| `toggle.{packageId}.originalRecurringPrice` | `currency` | The recurring charge before discounts. |

## Cautions

- **A money path renders nothing until the card's price fetch lands.** The card dispatches a `toggle:price-updated` DOM event when the numbers arrive — a browser event on the element, not one of the SDK events in [events.md](./events.md) — and the binding fills in then. Before that the element shows its markup fallback.
- **A path that names no live card stays silent.** A `{packageId}` no `[data-next-package-id]` card carries leaves the element untouched with no error — check the number against the markup when a binding never fills in.
- **An unrecognised property logs and stops.** Anything outside the tables above produces `Unknown toggle display property: "{property}"` at warn level; see [logs.md](./logs.md).

Generated from `package-toggle.display.ts › PackageToggleDisplayEnhancer.getPropertyValue` — the method that resolves these paths — so a name missing here is one the namespace does not answer, whatever else in the feature accepts it.
