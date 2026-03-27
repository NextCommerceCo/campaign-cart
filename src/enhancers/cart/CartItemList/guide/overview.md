# CartItemListEnhancer

> Category: `cart`
> Last reviewed: 2026-03-27
> Owner: campaign-cart

Renders one HTML block per cart item and keeps the list in sync with the cart store. Each rendered item automatically gets working quantity controls and a remove button without any additional setup.

## Concept

The enhancer subscribes to the cart store and re-renders its entire `innerHTML` whenever the item list changes. It is a read-only observer of the store — it never writes to cart state directly. Writing happens through `QuantityControlEnhancer` and `RemoveItemEnhancer` instances that the enhancer auto-initializes inside its rendered output after each update.

Rendering works in two paths depending on whether a template is provided:

- **Custom template**: the markup provided via `data-item-template-id`, `data-item-template-selector`, `data-item-template`, or the element's initial `innerHTML` is used as the per-item layout. Token replacement (`{item.name}`, `{item.finalPrice}`, etc.) fills in the item data.
- **Default template**: when no template is found, a built-in layout with image, name, variant info, pricing, quantity controls, and a remove button is rendered.

After each render, the enhancer scans for `[data-next-quantity]` and `[data-next-remove-item]` elements and instantiates `QuantityControlEnhancer` and `RemoveItemEnhancer` on them.

```
cartStore update
      │
      ▼
 handleCartUpdate()
 ├── cart empty?
 │     YES → renderEmptyCart() → emptyTemplate + CSS classes
 │     NO  → renderCartItems()
 │             ├── groupItems? → groupIdenticalItems()
 │             ├── renderCartItem() × N → token replacement
 │             ├── innerHTML changed?
 │             │     YES → set innerHTML + enhanceNewElements()
 │             └──   NO  → skip DOM update
```

## Business logic

- Renders only when `cartStore.items` is non-empty. When the cart is empty, the `data-empty-template` content is shown instead.
- Re-renders on every cart store update. Skips the DOM write if the rendered HTML is identical to the previous render (string comparison).
- After every DOM write, `QuantityControlEnhancer` and `RemoveItemEnhancer` are instantiated fresh on all matching elements. Do not attach event listeners to children of this enhancer — they are destroyed on every re-render.
- `data-group-items` collapses multiple cart lines with the same `packageId` into a single row, summing quantities. Grouped item IDs are tracked on `groupedItemIds` for downstream use.
- Title mapping applies before rendering: `data-title-map` (JSON) → `window.nextConfig.productTitleMap` → `window.nextConfig.productTitleTransform`. Earlier sources win.
- Conditional display helpers (`showCompare`, `showSavings`, `showDiscount`, etc.) output `"show"` or `"hide"`. Use these as CSS class names on wrapper elements to toggle visibility.

## Decisions

- We chose to replace the entire `innerHTML` on every change rather than patching individual tokens because tracking which tokens changed across arbitrary custom markup is fragile. Full replacement is predictable and keeps the renderer stateless.
- We chose to auto-initialize `QuantityControlEnhancer` and `RemoveItemEnhancer` after each render rather than requiring manual attribute scanner re-runs, because cart item lists are the only place these sub-enhancers appear inside a dynamically rendered container.
- We chose to skip the DOM write when HTML is unchanged (string comparison) because cart store updates fire on any field change, not just items — this prevents unnecessary re-renders on total or coupon updates.
- We chose `data-group-items` as a boolean flag rather than a grouping strategy enum because collapsing by `packageId` is the only grouping use case identified so far.
- We chose to support three template resolution paths (`data-item-template-id`, `data-item-template-selector`, inline element `innerHTML`) to accommodate both `<template>` element patterns and CMS-managed content where the template lives in a separate element.

## Limitations

- Does not support partial updates. Every render replaces all item rows. Do not attach event listeners to elements inside the list — they are destroyed on every re-render.
- `data-group-items` mutates the cloned item objects in memory. Grouped items are not written back to the cart store — grouping is display-only.
- Title mapping via `window.nextConfig.productTitleTransform` silently swallows errors. A broken transform returns the original title without any warning in the DOM.
- Does not emit any events. Other components that need to react to item list changes should subscribe to `cartStore` directly.
- The default template is cosmetically unstyled. It is intended as a functional fallback for development only — always provide a custom template in production.
- Renders all items on every update. Does not virtualize long lists. For very large carts (20+ items) this may cause layout shifts.
