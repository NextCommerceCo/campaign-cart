# Use Cases

## Add-on product selection

> Effort: lightweight

**When:** The campaign sells a primary product and offers one or more optional add-ons (extended warranty, accessories, replacement parts). Each add-on is independently chosen.

**Why this enhancer:** Cards are fully independent — checking one does not uncheck another. The cart is updated immediately on each click with no intermediate confirmation step.

**Watch out for:** If an add-on shares a `packageId` with a package in a `PackageSelectorEnhancer` on the same page, both enhancers will react to each other's cart writes. Use distinct `packageId` values for add-ons.

---

## Order bump

> Effort: lightweight

**When:** A single add-on offer is presented below the main offer form, styled as a checkbox or "yes/no" button. The user can tick it to include the bump product in their order.

**Why this enhancer:** Single-element toggle mode (`data-next-package-toggle` + `data-next-package-id` on the button itself) is the minimal markup for this pattern. `data-add-text` and `data-remove-text` handle the label change without JavaScript.

**Watch out for:** Do not mark the bump card as an upsell (`data-next-is-upsell`) if it appears on the main cart page. The `isUpsell` flag affects cart line classification — it is reserved for post-purchase upsells.

---

## Quantity-synced add-on (warranty per unit)

> Effort: moderate

**When:** An add-on like an extended warranty should match the quantity of the main product. If the user adds 3 units of the main product, the warranty should also be added at quantity 3.

**Why this enhancer:** `data-next-package-sync` mirrors the total quantity of the listed packages. When the main product quantity changes, the warranty quantity updates automatically. When the main product is removed entirely, the warranty is removed too.

**Watch out for:** The sync logic reads an internal `qty` field from the cart item. Verify that the synced package sets this field correctly. If the package has no `qty` override, each unit counts as 1 (the default). A sync card cannot be added (by click or auto-add) until at least one synced package is in the cart — this is intentional to prevent adding a warranty for a product that is not ordered.

**Static markup:**

```html
<div data-next-toggle-card
     data-next-package-id="999"
     data-next-package-sync="101,102"
     data-next-is-upsell="true">
  <span>Extended Warranty (matched to your order)</span>
  <span data-next-toggle-display="price"></span>
</div>
```

**Auto-render from JSON:**

```html
<div
  data-next-package-toggle
  data-next-packages='[
    {"packageId": 101, "name": "Widget"},
    {"packageId": 999, "name": "Extended Warranty", "packageSync": [101, 102], "selected": true}
  ]'
  data-next-toggle-template-id="warranty-tpl">
</div>
```

---

## Post-purchase upsell toggle

> Effort: requires backend changes

**When:** After a completed purchase, the confirmation page offers an additional product. Clicking the toggle adds it to the existing order via the post-purchase API, not the cart.

**Why this enhancer:** `data-next-upsell-context` switches the click handler to call `orderStore.addUpsell()` instead of `cartStore.addItem()`. The enhancer checks `orderStore.canAddUpsells()` first and navigates away safely if the window has closed.

**Watch out for:** The `orderStore` must have a valid order with upsell support enabled. If `canAddUpsells()` returns false, the click navigates to `data-next-url` instead of adding the product. Confirm with the backend team that the order type supports post-purchase upsells before shipping this pattern.

---

## Auto-rendered add-on cards from campaign data

> Effort: moderate

**When:** The set of add-on products is dynamic — determined by campaign configuration, not hardcoded in HTML. The template needs to render one card per product without a backend template engine.

**Why this enhancer:** `data-next-packages` accepts a JSON array that the enhancer renders at init time using the provided `<template>`. Campaign store data (name, image, price) is merged automatically so the template only needs `{toggle.*}` variables.

**Watch out for:** The template must produce a single root element. If the template renders a fragment or has no root, the card is silently skipped and a warning is logged. Always verify `cardCount` in the init log matches the number of items in `data-next-packages`.

---

## When NOT to use this

### The user should pick exactly one option

**Why not:** `PackageToggleEnhancer` has no mutual exclusion. Clicking a second card does not deselect the first — both packages end up in the cart.

**Use instead:** `PackageSelectorEnhancer` — designed for pick-one scenarios and drives the cart to always hold exactly the selected package.

### Adding multiple packages atomically as a bundle

**Why not:** Toggle adds and removes packages one at a time. Toggling two related packages in sequence creates intermediate cart states (one package in, one package out) that can trigger pricing or shipping recalculations unnecessarily.

**Use instead:** `BundleSelectorEnhancer` — designed for multi-package bundles and treats all packages in the bundle as a single atomic unit.
