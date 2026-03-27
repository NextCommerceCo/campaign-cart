# PackageSelectorEnhancer — Overview

The `PackageSelectorEnhancer` manages a group of mutually-exclusive selectable package cards.
The visitor picks exactly one package at a time.

---

## How it works

1. The enhancer scans for `[data-next-selector-card]` children and registers each as a selectable item.
2. On init it syncs with the cart — the card whose package is already in the cart is pre-selected.
3. When the visitor clicks a card, the selected card gets `next-selected`; in **swap** mode the cart
   is updated immediately via `cartStore.swapPackage()`.
4. Live prices are fetched from the calculate API and written into `[data-next-package-price]` slots.
5. `element._getSelectedItem()` and `element._getSelectedPackageId()` are exposed on the DOM element
   so `AddToCartEnhancer` can read the current selection when given a `data-next-selector-id`.

---

## Modes

| Mode | Attribute | Behaviour |
|---|---|---|
| **swap** (default) | `data-next-selection-mode="swap"` | Clicking a card immediately calls `cartStore.swapPackage()` |
| **select** | `data-next-selection-mode="select"` | Clicking only updates selection state; an `AddToCartEnhancer` button handles the cart write |

> **Do not** use swap mode when an `AddToCartEnhancer` button is also present — clicking a card
> fires a cart write, and the button fires another, resulting in two writes.

---

## CSS classes

| Class | When applied |
|---|---|
| `next-selector-card` | Added to every registered card on init |
| `next-selected` | The currently selected card |
| `next-in-cart` | Card whose package is present in the cart |
