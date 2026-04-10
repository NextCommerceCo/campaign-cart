# Glossary

## Add-on

An optional product offered alongside a primary purchase. Add-ons are independently selectable — choosing one does not affect others. Typically implemented with `PackageToggleEnhancer`.

---

## Auto-add

The behavior where a card marked `data-next-selected="true"` is automatically added to the cart when the enhancer initializes. Each package is auto-added at most once per page load, regardless of how many toggle elements reference it.

---

## Auto-render mode

A mode where the enhancer generates card elements from a JSON array (`data-next-packages`) and a `<template>` element, rather than reading pre-existing HTML cards. The enhancer replaces the container's `innerHTML` with the rendered cards at init time.

---

## Card

A single toggleable element within the enhancer. Each card maps to one package. Identified by the `data-next-toggle-card` attribute.

---

## Order bump

A single optional product offered on the checkout or cart page, styled as a checkbox or inline add-on. Implemented with single-element toggle mode.

---

## Provisional price

A price value derived from campaign package data (retail price, quantity) and available immediately at card registration time, before any `/calculate` API call. Template placeholders (`{toggle.price}`, `{toggle.originalPrice}`, etc.) are filled with provisional values. Live, cart-aware prices arrive after the first price fetch and are applied to `data-next-toggle-display` slots.

---

## Pre-selected

A card state indicating the package should be auto-added to the cart on init. Set via `data-next-selected="true"` on the card element or in the `data-next-packages` JSON (`"selected": true`).

---

## Conditional display (slot)

The ability to show or hide elements inside a card template based on template variables using `data-next-show` and `data-next-hide` attributes. Only variables that exist in the template vars map (e.g. `hasDiscount`, `isRecurring`, `isSelected`) are evaluated locally at render time. Store-based conditions (e.g. `cart.itemCount > 0`) are left for the global `ConditionalDisplayEnhancer`.

---

## Display slot

An element inside a card with `data-next-toggle-display` (or the deprecated `data-next-toggle-price`) that the enhancer populates after every price update. Different slot variants display the total price, per-unit price, retail/compare-at price, discount amount, discount percentage, recurring price, billing frequency, currency, or package name. Boolean variants (`hasDiscount`, `isRecurring`, `isSelected`) show or hide the element rather than writing text. Unrecognized values leave the element's content unchanged.

---

## Price slot

Older term for a display slot. Refers to elements marked with the now-deprecated `data-next-toggle-price` attribute. The attribute still works and accepts the same field names as `data-next-toggle-display`. Prefer `data-next-toggle-display` in new markup.

---

## Sync card

A card that does not have a fixed quantity. Instead its quantity mirrors the combined quantity of one or more other packages in the cart, specified via `data-next-package-sync`. Used for add-ons that must match the quantity of the primary product (for example, one warranty per unit purchased).

---

## Sync mode

The behavior of a card that uses `data-next-package-sync`. The card's quantity is calculated dynamically from the cart, not set as a static number. The card is added when any synced package is present and removed when all synced packages are removed.

---

## Toggle card

See [Card](#card).

---

## Upsell context

An operating mode where the enhancer targets the post-purchase order rather than the pre-purchase cart. Activated by `data-next-upsell-context` on the container. In this mode, clicking a card calls `orderStore.addUpsell()` and cannot remove a package (upsell adds are one-way).
