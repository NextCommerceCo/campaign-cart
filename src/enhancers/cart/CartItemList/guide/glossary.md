# Glossary

## Cart item

A single line in the cart, representing one package at a specific quantity. A cart can hold multiple items with the same `packageId` as separate lines.

---

## Conditional display helper

A template token whose value is either `"show"` or `"hide"`. Used as a CSS class on a wrapper element to toggle visibility: `.hide { display: none }`. Examples: `{item.showCompare}`, `{item.showDiscount}`, `{item.showRecurring}`.

---

## Empty template

The HTML shown inside the `data-next-cart-items` element when the cart has no items. Configured via `data-empty-template`. Defaults to `<div class="cart-empty">Your cart is empty</div>`.

---

## Grouping

An optional display mode (enabled via `data-group-items`) that collapses multiple cart lines with the same `packageId` into a single row with summed quantities. Grouping is display-only — the cart store still holds individual lines.

---

## Item template

The HTML markup used to render one cart item row. Defined as the element's initial `innerHTML`, a `<template>` child element, an external element referenced by ID or CSS selector, or inline via `data-item-template`. Token placeholders (`{item.*}`) are replaced with item data on each render.

---

## Package

A purchasable offering defined in the campaign. A cart item's `packageId` maps to a specific package in the campaign store.

---

## Package quantity (`packageQty`)

The number of product units bundled inside one package, as defined in the campaign (maps to `qty` on the campaign API). Distinct from `item.quantity`, which is the number of packages in the cart.

---

## Title map

A mapping from package ID to custom display title, used to override the campaign-defined package name in the cart list. Provided via `data-title-map` (JSON) or `window.nextConfig.productTitleMap`.

---

## Title transform

A developer-supplied function (`window.nextConfig.productTitleTransform`) that receives `(packageId, originalTitle)` and returns a custom title string. Called per-render. Errors are silently swallowed.

---

## Token

A placeholder in the item template of the form `{item.fieldName}` or `{item.fieldName|formatter}`. Replaced with the corresponding item data field during rendering. Numeric price fields accept the `currency` formatter: `{item.finalPrice|currency}`.
