# Get Started

## Prerequisites

- The campaign store must be initialized and populated before the selector initializes (handled by `SDKInitializer`).
- Each package you want to display must exist in the campaign data returned by the API.
- If using swap mode (default), the cart store must be available (`cartStore` is always available once the SDK loads).

## Setup

### Option A — Static cards

Mark up the container and cards directly in HTML. The enhancer discovers `[data-next-selector-card]` elements on init.

```html
<div
  data-next-package-selector
  data-next-selector-id="main-selector"
>
  <div
    data-next-selector-card
    data-next-package-id="101"
    data-next-selected="true"
  >
    <span data-next-package-price>—</span>
    <button>Select</button>
  </div>

  <div
    data-next-selector-card
    data-next-package-id="102"
  >
    <span data-next-package-price>—</span>
    <button>Select</button>
  </div>
</div>
```

### Option B — Auto-render from campaign data

Provide a template and a package list. The enhancer renders one card per entry using campaign store data.

1. Write a `<template>` element with a card inside it:

```html
<template id="pkg-card-tmpl">
  <div data-next-selector-card>
    <strong>{package.name}</strong>
    <span data-next-package-price>—</span>
  </div>
</template>
```

2. Reference it from the container, passing the package IDs:

```html
<div
  data-next-package-selector
  data-next-selector-id="main-selector"
  data-next-package-template-id="pkg-card-tmpl"
  data-next-packages='[{"packageId":101,"selected":true},{"packageId":102}]'
>
</div>
```

### Select mode with an Add to Cart button

When a button should trigger the cart add rather than card click:

```html
<div
  data-next-package-selector
  data-next-selector-id="main-selector"
  data-next-selection-mode="select"
>
  <div data-next-selector-card data-next-package-id="101" data-next-selected="true">
    <span data-next-package-price>—</span>
  </div>
  <div data-next-selector-card data-next-package-id="102">
    <span data-next-package-price>—</span>
  </div>
</div>

<button
  data-next-action="add-to-cart"
  data-next-selector-id="main-selector"
>
  Add to Cart
</button>
```

## Verify it is working

After the page loads with the SDK initialized, you should see:

- One card has the `next-selected` CSS class and `data-next-selected="true"`.
- The container has `data-selected-package` set to the selected package ID.
- In swap mode, opening the cart shows the pre-selected package already added.
- `[data-next-package-price]` slots display prices fetched from the API (not `—`).
- Clicking another card moves `next-selected` to that card and, in swap mode, the cart updates.

## Next steps

- Explore use cases: [use-cases.md](./use-cases.md)
- Configure all attributes: [reference/attributes.md](./reference/attributes.md)
- See what events the selector emits: [reference/events.md](./reference/events.md)
- Understand how it relates to other enhancers: [relations.md](./relations.md)
