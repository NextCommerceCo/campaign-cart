# Get Started

## Prerequisites

- The 29Next SDK is initialized on the page (`NextCommerce.init()`).
- Package `ref_id` values are known. Find them in the campaign data or from your backend team.
- The cart store is available (it initializes automatically with the SDK).

## Setup

### Option A — Static cards

1. Add a container element with `data-next-package-toggle`.
2. Inside it, add one child element per package with `data-next-toggle-card` and `data-next-package-id`.
3. Optionally add price slots, image slots, and button text attributes.
4. Add CSS for `next-in-cart` and `next-not-in-cart` to style the selected/unselected states.

```html
<div data-next-package-toggle>
  <div data-next-toggle-card data-next-package-id="101" data-next-selected="true">
    <span>Extra Battery</span>
    <span data-next-toggle-display="price"></span>
    <del data-next-toggle-display="originalPrice"></del>
  </div>
  <div data-next-toggle-card data-next-package-id="102">
    <span>Carrying Case</span>
    <span data-next-toggle-display="price"></span>
  </div>
</div>
```

### Option B — Single-element toggle

Place `data-next-package-toggle` and `data-next-package-id` directly on a button. No child cards needed.

```html
<button
  data-next-package-toggle
  data-next-package-id="101"
  data-add-text="Add Extended Warranty"
  data-remove-text="✓ Warranty Added">
  Add Extended Warranty
</button>
```

### Option C — Auto-render from JSON

Provide a JSON array in `data-next-packages` and a `<template>` element. The enhancer renders one card per entry.

```html
<div
  data-next-package-toggle
  data-next-packages='[
    {"packageId": 101, "name": "Extra Battery", "selected": true},
    {"packageId": 102, "name": "Carrying Case"}
  ]'
  data-next-toggle-template-id="toggle-tpl">
</div>

<template id="toggle-tpl">
  <div data-next-toggle-card>
    <strong>{toggle.name}</strong>
    <span data-next-toggle-display="price"></span>
  </div>
</template>
```

### Option D — Auto-render with quantity sync

Combine auto-render with `packageSync` to render a sync card from JSON. The warranty card below mirrors the quantity of package 101.

```html
<div
  data-next-package-toggle
  data-next-packages='[
    {"packageId": 101, "name": "Widget"},
    {"packageId": 200, "name": "Extended Warranty", "packageSync": [101]}
  ]'
  data-next-toggle-template-id="toggle-tpl">
</div>

<template id="toggle-tpl">
  <div data-next-toggle-card>
    <strong>{toggle.name}</strong>
    <span data-next-toggle-display="price"></span>
  </div>
</template>
```

The `packageSync` field accepts a comma-separated string (`"101,102"`) or an array (`[101, 102]`). The rendered card receives `data-next-package-sync` and activates sync mode automatically.

### Display card data outside the toggle container

Use `data-next-display="toggle.{packageId}.{property}"` to bind any element on the page to a specific toggle card's state. The element does not need to be inside the card or the container.

```html
<!-- These can go anywhere in the document -->
<span data-next-display="toggle.101.isSelected"></span>
<span data-next-display="toggle.101.price"></span>
<span data-next-display="toggle.101.discountAmount" data-hide-if-zero="true"></span>
<span data-next-display="toggle.101.discountPercentage"></span>
```

**Supported properties:** `packageId`, `name`, `image`, `quantity`, `productId`, `variantName`, `productName`, `sku`, `price`, `unitPrice`, `originalPrice`, `originalUnitPrice`, `discountAmount`, `discountPercentage`, `isSelected`, `hasDiscount`, `isRecurring`, `recurringPrice`, `originalRecurringPrice`, `interval`, `intervalCount`, `frequency`, `currency`

`isSelected` updates on every cart sync. Prices update after the async price fetch completes.

## Verify it is working

After the SDK initializes you should see:

- Any card with `data-next-selected="true"` has the `next-in-cart` class and the package appears in the cart.
- Clicking an inactive card adds `next-in-cart` to it and triggers a cart add (visible in the cart summary or network tab).
- Clicking an active card removes `next-in-cart` and triggers a cart remove.
- Price slots populate with formatted prices within a short delay after init.
- The browser console (with debug logging enabled) shows `PackageToggleEnhancer initialized` with a `cardCount`.

## Next steps

- Explore common product scenarios: [use-cases.md](./use-cases.md)
- Configure all available attributes: [reference/attributes.md](./reference/attributes.md)
- See all events emitted: [reference/events.md](./reference/events.md)
- Understand how this enhancer relates to others: [relations.md](./relations.md)
