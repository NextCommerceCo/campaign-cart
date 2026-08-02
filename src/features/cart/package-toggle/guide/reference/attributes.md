---
title: "Features/Cart/Package Toggle/Attributes"
group: "Features"
category: "Package Toggle"
---

# Attributes

<!-- Generated from the feature manifest. Do not edit by hand:
     edit <feature>.manifest.ts, then run `npm run docs:reference`. -->

Turns an add-on — a warranty, express shipping, a bonus item — on and off in the cart with one click.

Turned on by `[data-next-package-toggle]`.

## Container attributes

### `data-next-package-toggle`

| | |
|---|---|
| Type | `boolean (presence)` |
| Required | yes |
| Default | — |

Marks the container — or, in single-element mode, the one toggle element. The feature activates on this element.

---

### `data-next-packages`

| | |
|---|---|
| Type | `JSON string` |
| Required | no |
| Default | — |

A JSON array of package definitions used to auto-render cards instead of writing each one by hand. Each entry needs `packageId`; any other key is available to the template as `{toggle.<key>}`. Set `"selected": true` to add that package on load, and `"packageSync"` to a package-id list to render the card in sync mode.

```json
[
  { "packageId": 101, "name": "Widget" },
  { "packageId": 200, "name": "Extended Warranty", "packageSync": [101] }
]
```

**Valid values:** a valid JSON array — invalid JSON is ignored with a warning

> **Watch out:** Auto-render needs a template too: set `data-next-toggle-template-id` or `data-next-toggle-template`, or give the container a `<template>` child.

---

### `data-next-toggle-template-id`

| | |
|---|---|
| Type | `string` |
| Required | no |
| Default | — |

Id of a `<template>` element whose `innerHTML` is the card template. Highest precedence of the three template sources.

---

### `data-next-toggle-template`

| | |
|---|---|
| Type | `string (HTML)` |
| Required | no |
| Default | — |

The card template as an inline HTML string. Reach for `data-next-toggle-template-id` once the template grows past a few elements.

---

### `data-next-include-shipping`

| | |
|---|---|
| Type | `'true' \| 'false'` |
| Required | no |
| Default | `false` |

When `true`, shipping is included in the price shown on cards that are not yet in the cart, so the preview matches what the cart will say.

---

### `data-next-upsell-context`

| | |
|---|---|
| Type | `boolean (presence)` |
| Required | no |
| Default | — |

Switches to post-purchase upsell mode: a click adds to the existing order rather than the cart, and the feature stops watching the cart store.

## Card attributes

### `data-next-toggle-card`

| | |
|---|---|
| Type | `boolean (presence)` |
| Required | yes |
| Default | — |

Marks an element as a toggle card inside the container. Each card gets its own click handler and cart-state tracking.

---

### `data-next-package-id`

| | |
|---|---|
| Type | `number` |
| Required | yes |
| Default | — |

The `ref_id` of the package this card toggles. Must match a package in the campaign.

---

### `data-next-selected`

| | |
|---|---|
| Type | `'true'` |
| Required | no |
| Default | — |

Adds this package to the cart when the page loads, for an add-on that is opt-out rather than opt-in. Skipped if the package is already in the cart, and applied at most once per page load.

> **Watch out:** On a sync card the auto-add waits until at least one synced package is in the cart, so an add-on cannot appear before the product it belongs to.

---

### `data-next-quantity`

| | |
|---|---|
| Type | `number` |
| Required | no |
| Default | `1` |

How many units to add when the card is toggled on.

> **Watch out:** Ignored when `data-next-package-sync` or `data-next-product-sync` is set — those derive the quantity instead.

---

### `data-next-package-sync`

| | |
|---|---|
| Type | `string (comma-separated ids)` |
| Required | no |
| Default | — |

Keeps this card's quantity equal to the combined quantity of the listed packages — one warranty per unit sold, without the visitor managing it. When every synced package leaves the cart, this card is removed too.

**Example:** `"101,102"` — quantity becomes (qty of 101) + (qty of 102).

> **Watch out:** Clicking a sync card while none of its synced packages are in the cart does nothing. If the synced product has variants the visitor can swap, use `data-next-product-sync` instead — a swap changes the package id but not the product id.

---

### `data-next-product-sync`

| | |
|---|---|
| Type | `string (comma-separated ids)` |
| Required | no |
| Default | — |

Same idea as `data-next-package-sync`, but matched on product id, so every variant of a product counts toward the total. Use it when the visitor can swap variants.

**Example:** `"55"` — quantity becomes the total across all cart lines for product 55.

> **Watch out:** Both sync attributes may be set on one card; their totals are added together.

---

### `data-next-is-upsell`

| | |
|---|---|
| Type | `'true' \| 'false'` |
| Required | no |
| Default | `false` |

Marks the resulting cart line as an upsell or bump item, which changes how it is classified in the cart and in analytics.

> **Watch out:** It also delays sync-driven removal by 500ms, so a variant swap does not briefly drop the add-on and re-add it.

---

### `data-next-bump`

| | |
|---|---|
| Type | `boolean (presence)` |
| Required | no |
| Default | — |

Marks the card as an order bump. Also detected when the card sits inside a `[data-next-bump-section]`, so a whole section can be marked at once.

---

### `data-next-exclude-property`

| | |
|---|---|
| Type | `string` |
| Required | no |
| Default | — |

Custom-property keys this card should not copy onto its cart line, comma separated. Use it when an add-on should not inherit engraving text or a gift message from the main product.

---

### `data-add-text`

| | |
|---|---|
| Type | `string` |
| Required | no |
| Default | — |

Button label while the package is out of the cart. Written into a `[data-next-button-text]` child if there is one, otherwise into the element's own text.

> **Watch out:** Only applied when `data-remove-text` is set as well.

---

### `data-remove-text`

| | |
|---|---|
| Type | `string` |
| Required | no |
| Default | — |

Button label while the package is in the cart.

> **Watch out:** Only applied when `data-add-text` is set as well.

---

### `data-next-toggle-container`

| | |
|---|---|
| Type | `boolean (presence)` |
| Required | no |
| Default | — |

Marks a wrapper as this card's state container, so the state attributes and classes below land on the wrapper instead of the clickable element. Use it when the element you want to style is not the one you want clickable.

---

### `data-next-upsell-item`

| | |
|---|---|
| Type | `boolean (presence)` |
| Required | no |
| Default | — |

Alternative marker for the state container, for markup already using upsell-item wrappers.

## Display slots (inside a card)

### `data-next-toggle-display`

| | |
|---|---|
| Type | `string (field name)` |
| Required | no |
| Default | `price` |

Marks an element inside a card as a display slot. After every price update the named field's value is written into it. See **Display fields** below for the field names.

> **Watch out:** For the boolean fields the element is shown or hidden instead of receiving text. `isSelected` here reflects the `data-next-selected` attribute as of the last price update, not live cart state — for live state use `data-next-display="toggle.{packageId}.isSelected"`.

---

### `data-next-toggle-price`

| | |
|---|---|
| Type | `string (field name)` |
| Required | no |
| Default | `price` |

Deprecated spelling of `data-next-toggle-display`, kept working for existing markup. Same field names, same output — prefer `data-next-toggle-display` in anything new.

---

### `data-next-toggle-image`

| | |
|---|---|
| Type | `boolean (presence)` |
| Required | no |
| Default | — |

Put on an `<img>` inside a card. Its `src` is set to the package image, and its `alt` to the package name when no `alt` is already there.

---

### `data-next-discounts`

| | |
|---|---|
| Type | `'' \| 'offer' \| 'voucher'` |
| Required | no |
| Default | `(empty)` |

Lists the discounts applied to this card's package — one row per discount. Leave the value empty for every discount, or narrow it to one kind.

**Valid values:**

- `(empty)` — Every discount, offer and voucher alike.
- `offer` — Only discounts from an offer.
- `voucher` — Only discounts from a coupon or voucher code.

> **Watch out:** The container is re-rendered on every price update, so do not attach listeners to the rows it produces.

## Upsell navigation

### `data-next-url`

| | |
|---|---|
| Type | `string` |
| Required | no |
| Default | `the meta[name="next-upsell-accept-url"] content` |

In upsell mode, where to send the visitor after the add succeeds. Looked for on the card, then the state container, then the container, then the meta tag. The order id is appended as a query parameter if it is not already there.

## Read from other elements

These are not placed on the element this feature is bound to — look for them on inputs elsewhere in the page, or on a linked selector.

| Name | Values | Meaning |
|---|---|---|
| `data-next-upsell-section` | — | Read from an enclosing section: marks everything inside it as upsell content, so cards do not each need `data-next-is-upsell`. |

## Set by the feature

Written to the element as state changes. Read these from CSS or tests instead of inferring state from the rendered text.

| Name | Values | Meaning |
|---|---|---|
| `data-next-in-cart` | `true` / `false` | On the card: whether this card's package is in the cart. |
| `data-next-active` | `true` / `false` | On the state container: the same in-cart state, for styling a wrapper rather than the clickable element. |
| `data-next-loading` | `true` / `false` | On the card: `true` while a price fetch or cart write for this card is in flight. |

## CSS classes

Toggled by the feature. Style these rather than tracking the same state yourself.

| Name | Values | Meaning |
|---|---|---|
| `next-toggle-card` | — | Applied to every registered card. |
| `next-in-cart` | — | This card's package is in the cart. |
| `next-not-in-cart` | — | This card's package is not in the cart. |
| `next-selected` | — | The card is in its selected state. |
| `next-active` | — | Applied to the state container while in cart. |
| `next-loading` | — | A price fetch or cart write is in flight. |
| `os--active` | — | Compatibility class for starter-template styling that predates the namespaced classes. |

## Card template resolution order

For auto-render there are three ways to supply the card template, checked in this
order — the first one present wins:

1. `data-next-toggle-template-id` — id of a `<template>` element anywhere in the page
2. `data-next-toggle-template` — an inline HTML string on the container
3. a direct `<template>` child of the container

```html
<div data-next-package-toggle
     data-next-packages='[{"packageId":200,"name":"Extended Warranty"}]'>
  <template>
    <div data-next-toggle-card data-next-package-id="{package.packageId}">
      {package.name} — <span data-next-toggle-display="price"></span>
    </div>
  </template>
</div>
```

## Display fields

These field names are accepted by `data-next-toggle-display` (and its deprecated
twin `data-next-toggle-price`) for slots **inside** a card, and by
`data-next-display="toggle.{packageId}.{field}"` for elements **anywhere** in the
page. One list serves both — an unrecognised name leaves the element untouched.

Every field, with its default format and what it shows, is listed once in
[display-paths.md](./display-paths.md) — read out of the method that answers the
path, so it cannot drift from what renders. Two of them behave differently in the
in-card form: `image` sets `src` on an `<img>` rather than writing text, and
`isSelected` reflects `data-next-selected` as of the last price update rather than
live cart state.

The standard display modifiers apply to the `data-next-display` form:
`data-next-format`, `data-hide-if-zero`, `data-hide-if-false`.
