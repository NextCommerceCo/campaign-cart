# Get Started

## Prerequisites

- The campaign store must be initialized and populated before the enhancer initializes (handled by `SDKInitializer`).
- Each package referenced in a bundle's `items` array must exist in the campaign data returned by the API.
- If using swap mode (default), the cart store must be available — it is always available once the SDK loads.

## Setup

### Option A — Static cards

Mark up the container and bundle cards directly in HTML. The enhancer discovers `[data-next-bundle-card]` elements on init.

```html
<div data-next-bundle-selector>

  <div
    data-next-bundle-card
    data-next-bundle-id="starter"
    data-next-bundle-items='[{"packageId":101,"quantity":1}]'
    data-next-selected="true"
  >
    <strong>Starter — 1 bottle</strong>
    <span data-next-bundle-display>—</span>
  </div>

  <div
    data-next-bundle-card
    data-next-bundle-id="value"
    data-next-bundle-items='[{"packageId":101,"quantity":3}]'
  >
    <strong>Value — 3 bottles</strong>
    <span data-next-bundle-display>—</span>
    <span data-next-bundle-display="originalPrice">—</span>
    <span data-next-bundle-display="discountAmount">—</span>
  </div>

</div>
```

### Option B — Auto-render from a template

Provide a `<template>` element and a `data-next-bundles` JSON array. The enhancer renders one card per entry.

1. Write the template. The root element inside the template must have `data-next-bundle-card` or be the outermost element. Do not include `data-next-bundle-items` in the template — the enhancer sets it automatically from the JSON definition:

```html
<template id="bundle-tmpl">
  <div
    data-next-bundle-card
    data-next-bundle-id="{bundle.id}"
  >
    <strong>{bundle.title}</strong>
    <span data-next-bundle-display>—</span>
  </div>
</template>
```

2. Reference the template from the container and provide the bundle definitions:

```html
<div
  data-next-bundle-selector
  data-next-bundle-template-id="bundle-tmpl"
  data-next-bundles='[
    {"id":"starter","title":"Starter","items":[{"packageId":101,"quantity":1}],"selected":true},
    {"id":"value","title":"Value Pack","items":[{"packageId":101,"quantity":3}]}
  ]'
>
</div>
```

### Option C — Bundles with slot rendering

When you want to show the individual products inside each bundle, add a slot template. Add `[data-next-bundle-slots]` inside the bundle card where slots should appear.

```html
<template id="slot-tmpl">
  <div>
    <img src="{item.image}" alt="{item.name}">
    <span>{item.name}</span>
    <span>{item.qty}x</span>
    <span data-next-bundle-display>—</span>
  </div>
</template>

<div
  data-next-bundle-selector
  data-next-bundle-template-id="bundle-tmpl"
  data-next-bundle-slot-template-id="slot-tmpl"
  data-next-bundles='[...]'
>
</div>
```

Inside the bundle card template, add a placeholder where slots will be injected:

```html
<template id="bundle-tmpl">
  <div data-next-bundle-card data-next-bundle-id="{bundle.id}">
    <strong>{bundle.title}</strong>
    <div data-next-bundle-slots></div>
    <span data-next-bundle-display>—</span>
  </div>
</template>
```

### Option D — Select mode with an external action

When a button should trigger the cart add rather than the card click:

```html
<div
  data-next-bundle-selector
  data-next-selection-mode="select"
  data-next-selector-id="main-bundle"
>
  <div
    data-next-bundle-card
    data-next-bundle-id="starter"
    data-next-bundle-items='[{"packageId":101,"quantity":1}]'
    data-next-selected="true"
  >
    Starter
  </div>
  <div
    data-next-bundle-card
    data-next-bundle-id="value"
    data-next-bundle-items='[{"packageId":101,"quantity":3}]'
  >
    Value Pack
  </div>
</div>

<button data-next-action="add-to-cart" data-next-selector-id="main-bundle">
  Add to Cart
</button>
```

### Option E — Display bundle data outside the card

Use `data-next-display="bundle.{bundleId}.{property}"` to bind any element on the page to a specific bundle card's state. The element does not need to be inside the card or the selector container.

```html
<!-- These can go anywhere in the document -->
<span data-next-display="bundle.starter.price"></span>
<span data-next-display="bundle.starter.isSelected"></span>
<span data-next-display="bundle.value.savings" data-hide-if-zero="true"></span>
<span data-next-display="bundle.value.savingsPercentage"></span>
```

**Supported properties:** `isSelected`, `name`, `price`, `originalPrice`, `discountAmount`, `discountPercentage`, `hasDiscount`, `unitPrice`, `originalUnitPrice`

Prices update automatically after the async price fetch completes. `isSelected` updates on every card click.

## Price display: which system to use

There are two ways to show bundle prices. Use whichever fits your layout:

| Situation | Use |
|---|---|
| Price element is **inside** the bundle card | `data-next-bundle-display` — simpler, no ID needed |
| Price element is **outside** the card (e.g., sticky bar, comparison table) | `data-next-display="bundle.{bundleId}.price"` |

Both read from the same calculated value and update at the same time. Do not use both on the same element.

## Verify it is working

After the page loads with the SDK initialized, you should see:

- One card has the `next-selected` CSS class and `data-next-selected="true"`.
- The container has `data-selected-bundle` set to the selected bundle's ID.
- In swap mode, the pre-selected bundle's packages are in the cart after init.
- `[data-next-bundle-display]` elements display formatted prices (not `—`) once the price fetch completes.
- Clicking another card moves `next-selected` to that card and, in swap mode, the cart updates to reflect the new bundle.

In the browser console with debug logging enabled, you should see:

```
[BundleSelectorEnhancer] Registered bundle card "starter" { itemCount: 1 }
[BundleSelectorEnhancer] Registered bundle card "value" { itemCount: 1 }
[BundleSelectorEnhancer] BundleSelectorEnhancer initialized { mode: "swap", cardCount: 2 }
```

## Next steps

- Explore use cases: [use-cases.md](./use-cases.md)
- Configure all attributes: [reference/attributes.md](./reference/attributes.md)
- See what events are emitted: [reference/events.md](./reference/events.md)
- Understand relations to other enhancers: [relations.md](./relations.md)
- Template variable reference for slot templates: [reference/object-attributes.md](./reference/object-attributes.md)
