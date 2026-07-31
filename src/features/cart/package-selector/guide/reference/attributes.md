---
title: "Features/Cart/Package Selector/Attributes"
group: "Features"
category: "Package Selector"
---

# Attributes

<!-- Generated from the feature manifest. Do not edit by hand:
     edit <feature>.manifest.ts, then run `npm run docs:reference`. -->

Presents a group of packages as cards and tracks which one the visitor picked — optionally writing the choice straight to the cart.

Turned on by `[data-next-package-selector]`.

## Container attributes

### `data-next-package-selector`

| | |
|---|---|
| Type | `boolean (presence)` |
| Required | yes |
| Default | — |

Marks the element as a package selector container and triggers instantiation by `AttributeScanner`. Must be on the outermost container element.

---

### `data-next-selector-id`

| | |
|---|---|
| Type | `string` |
| Required | yes |
| Default | — |

Unique identifier for this selector instance. Other features — the add-to-cart button, accept-upsell buttons, display bindings — use this value to find the selector and read the current selection.

**Valid values:** any non-empty string, unique on the page

---

### `data-next-selection-mode`

| | |
|---|---|
| Type | `'swap' \| 'select'` |
| Required | no |
| Default | `swap` |

Controls whether clicking a card writes to the cart immediately.

**Valid values:**

- `swap` — A card click adds or swaps the package in the cart automatically.
- `select` — A card click only updates visual state. An external add-to-cart button performs the cart write.

> **Watch out:** Forced to `select` when `data-next-upsell-context` is present. Pairing `swap` mode with an add-to-cart button on the same selector produces two cart writes per click — pick one.

---

### `data-next-upsell-context`

| | |
|---|---|
| Type | `boolean (presence)` |
| Required | no |
| Default | — |

Marks the selector as part of a post-purchase upsell flow. Cart store operations are disabled, the mode is forced to `select`, and prices are fetched with the `upsell=true` flag so the API can apply upsell-specific pricing.

---

### `data-next-include-shipping`

| | |
|---|---|
| Type | `'true' \| 'false'` |
| Required | no |
| Default | `false` |

When `true`, shipping cost is included in the price calculation sent to the bundle price API, and therefore in what the price slots display.

---

### `data-next-packages`

| | |
|---|---|
| Type | `JSON string` |
| Required | no |
| Default | — |

A JSON array of package definitions used to auto-render the cards, instead of writing each card by hand. Each object needs at least `packageId`; any other key is exposed to the card template as `{package.<key>}`.

```html
data-next-packages='[{"packageId":101,"selected":true},{"packageId":102}]'
```

**Valid values:** a valid JSON array — non-array values are ignored with a warning

---

### `data-next-package-template-id`

| | |
|---|---|
| Type | `string` |
| Required | no |
| Default | — |

Id of a `<template>` element whose `innerHTML` is the card template for auto-rendering. Highest precedence of the three template sources.

---

### `data-next-package-template`

| | |
|---|---|
| Type | `string (HTML)` |
| Required | no |
| Default | — |

The card template as an inline HTML string. Used when `data-next-package-template-id` is absent.

## Card attributes

### `data-next-selector-card`

| | |
|---|---|
| Type | `boolean (presence)` |
| Required | yes |
| Default | — |

Marks an element as a card inside the container. The selector scans for these on init and on DOM mutations, so cards added later are picked up.

---

### `data-next-package-id`

| | |
|---|---|
| Type | `number` |
| Required | yes |
| Default | — |

The `ref_id` of the package this card represents.

> **Watch out:** Cards with a missing or non-integer value are skipped with a warning — the card renders but does nothing when clicked.

---

### `data-next-selected`

| | |
|---|---|
| Type | `'true' \| 'false'` |
| Required | no |
| Default | `false` |

Marks this card as pre-selected on load. Only the first card with `true` wins; later ones are ignored. The selector also writes this attribute at runtime to reflect the current selection.

---

### `data-next-quantity`

| | |
|---|---|
| Type | `number` |
| Required | no |
| Default | `1` |

This card's starting quantity. Written back by the selector when inline quantity controls change it.

---

### `data-next-min-quantity`

| | |
|---|---|
| Type | `number` |
| Required | no |
| Default | `1` |

Lowest quantity the inline controls allow. The decrease button is disabled at this value.

---

### `data-next-max-quantity`

| | |
|---|---|
| Type | `number` |
| Required | no |
| Default | `999` |

Highest quantity the inline controls allow. The increase button is disabled at this value.

---

### `data-next-shipping-id`

| | |
|---|---|
| Type | `number` |
| Required | no |
| Default | — |

Shipping method to apply when this card is selected. Applied in `swap` mode only.

> **Watch out:** A non-integer value is logged as a warning and ignored, so the cart silently keeps the previous shipping method.

## Price slots (inside a card)

### `data-next-package-price`

| | |
|---|---|
| Type | `string (price variant)` |
| Required | no |
| Default | — |

Place on an element inside a card. The selector writes the formatted price into that element after fetching from the bundle price API. With no value, it shows the card's total.

**Valid values:**

- `(empty)` — Total price for this package at the current quantity.
- `compare` — Retail / compare-at price before discounts.
- `savings` — Discount amount — compare price minus total.
- `savingsPercentage` — Discount as a percentage of the compare price.
- `subtotal` — Subtotal before shipping and discounts.

## Inline quantity controls (inside a card)

### `data-next-quantity-increase`

| | |
|---|---|
| Type | `boolean (presence)` |
| Required | no |
| Default | — |

Button inside a card that adds 1 to that card's quantity. Wired up automatically when present. Disabled — `disabled` attribute plus `next-disabled` class — at `data-next-max-quantity`.

---

### `data-next-quantity-decrease`

| | |
|---|---|
| Type | `boolean (presence)` |
| Required | no |
| Default | — |

Button inside a card that subtracts 1 from that card's quantity. Disabled at `data-next-min-quantity`.

---

### `data-next-quantity-display`

| | |
|---|---|
| Type | `boolean (presence)` |
| Required | no |
| Default | — |

Element inside a card whose text content is kept in sync with that card's current quantity.

## Set by the feature

Written to the element as state changes. Read these from CSS or tests instead of inferring state from the rendered text.

| Name | Values | Meaning |
|---|---|---|
| `data-selected-package` | package id as a string | On the container: the currently selected package id. This is the DOM fallback other features read when they cannot call the selector directly, so a page can render with a selection already in place. |
| `data-next-loading` | `true` / `false` | On the container: `true` while price data is being fetched, `false` once it resolves. Drive a skeleton or spinner off this rather than guessing at timing. |
| `data-next-selected` | `true` / `false` | On each card: whether it is the current selection. Also accepted as input for the initial state. |
| `data-next-in-cart` | `true` / `false` | On each card: whether this card's package is currently in the cart. |
| `data-package-price-total` | float as a string | On each card after a price fetch: the raw numeric total. These raw values exist so display bindings and tests can read numbers without parsing formatted currency. |
| `data-package-price-compare` | float as a string, or empty | On each card after a price fetch: the raw retail / compare-at price. Empty string when there is no compare price. |
| `data-package-price-savings` | float as a string | On each card after a price fetch: the raw savings amount. `0` when there are none. |
| `data-package-price-savings-pct` | float as a string | On each card after a price fetch: the raw savings percentage, 0–100. `0` when there are none. |

## Card template resolution order

There are three ways to supply the card template for auto-rendering, checked in
this order — the first one present wins:

1. `data-next-package-template-id` — id of a `<template>` element anywhere in the page
2. `data-next-package-template` — an inline HTML string on the container
3. a direct `<template>` child of the container

```html
<div data-next-package-selector
     data-next-selector-id="main"
     data-next-packages='[{"packageId":101},{"packageId":102}]'>
  <template>
    <div data-next-selector-card data-next-package-id="{package.packageId}">
      {package.name} — <span data-next-package-price></span>
    </div>
  </template>
</div>
```

## Display system integration

To show a card's state somewhere else on the page, bind an element with
`data-next-display="selector.{selectorId}.{packageId}.{property}"`. The element
does not have to live inside the card, or even inside the container.

```html
<span data-next-display="selector.main.101.price"></span>
<span data-next-display="selector.main.101.savings" data-hide-if-zero="true"></span>
```

| Property | Format | Shows |
|---|---|---|
| `isSelected` | boolean | Whether this card is the current selection |
| `isInCart` | boolean | Whether this card's package is in the cart |
| `price` | currency | Total for the package at its current quantity |
| `compare` | currency | Retail / compare-at price |
| `savings` | currency | Compare price minus total |
| `savingsPercentage` | percentage | Discount as a share of the compare price |
| `hasSavings` | boolean | Whether savings are above zero |

The standard display modifiers apply: `data-next-format`, `data-hide-if-zero`,
`data-hide-if-false`.

## Conflicts

- `package-toggle` — the selector enforces one choice at a time while a toggle is independent per card, so a package in both ends up in the cart without the selector knowing. Keep their package sets disjoint.
- `add-to-cart` in `swap` mode — in `swap` mode the selector writes to the cart on every card click, so adding a button that also writes doubles the cart write. Use `select` mode when there is a button.
