# CartSummaryEnhancer

> Category: `cart`
> Last reviewed: 2026-03-27
> Owner: campaign-cart

A reactive display block that shows the current cart totals — subtotal, discounts, shipping, tax, and grand total — and updates automatically whenever the cart changes. Supports a built-in default layout or a fully custom template defined in markup.

## Concept

The enhancer subscribes to the cart store and re-renders its content whenever the totals, API summary, or item count changes. It is a read-only observer: it never writes to the cart.

Rendering works in two paths depending on whether a `<template>` child is present:

- **Default path**: the enhancer generates a standard row layout (subtotal, discounts, shipping, tax, total) using its built-in template. Optional rows (discounts, tax) are shown only when their values are non-zero.
- **Custom path**: the enhancer uses the `<template>` child's markup as the layout. Token replacement (`{subtotal}`, `{total}`, etc.) fills in the formatted values. List containers for line items and discount breakdowns are wired up after token replacement.

In both paths, state CSS classes are applied to the host element on every render so CSS can show or hide rows conditionally (e.g. `.next-no-discounts .discount-row { display: none }`).

```
cartStore update
      │
      ▼
 handleCartUpdate()
 ├── totals changed?
 ├── summary changed?
 └── item count changed?
       │
       YES → render()
             ├── buildFlags(totals)       → SummaryFlags
             ├── buildVars(totals, flags) → TemplateVars
             ├── updateStateClasses()     → apply CSS classes to host
             └── customTemplate?
                 ├── YES → renderCustom() → token replacement + list containers
                 └── NO  → renderDefault() → built-in row layout
```

## Business logic

- Renders only when `cartStore.totals` is populated. Before the cart is initialized, the element is empty.
- Re-renders on every change to `totals`, `summary`, or item count — not on every store tick. Reference equality is used to skip unnecessary renders.
- Shipping is displayed as "Free" when its value is zero. `{shippingOriginal}` is empty when no shipping discount is applied.
- Discounts combine offer and voucher discounts into a single `{discounts}` total. Separate breakdown lists (`data-summary-offer-discounts`, `data-summary-voucher-discounts`) are available in custom templates.
- `{savings}` covers retail price savings (compare-at minus price) plus applied discounts. `{compareTotal}` is the full retail total before savings.
- List containers (`data-summary-lines`, `data-summary-offer-discounts`, `data-summary-voucher-discounts`) replace their non-template children entirely on each render. Children are cleared and rebuilt from the list template.
- Line items are sorted by `package_id` ascending before rendering.
- `{line.hasDiscount}` outputs `"show"` or `"hide"` — intended as a CSS class or `data-` flag, not directly displayed.
- `{line.hasSavings}` outputs `"show"` when the line has retail savings or a discount applied, `"hide"` otherwise.

## Decisions

- We chose to re-render the full `innerHTML` on every cart change rather than patching individual values because diffing template slots across arbitrary markup is fragile and error-prone. Full replacement is predictable.
- We chose to apply state CSS classes to the host element rather than requiring separate `ConditionalDisplayEnhancer` instances, because the most common use case is hiding/showing rows within the same block via CSS, not across elements.
- We chose a `<template>` child (not a `data-` attribute or external template ID) so that the layout is co-located with the element in the HTML, making it easier to read and maintain.
- We chose to separate `offer_discounts` and `voucher_discounts` into distinct list containers so that merchants can style them differently (e.g., different icons or labels) without parsing a combined string.
- We chose not to emit any events because this enhancer has no user-interactive state. Other enhancers writing to the cart are the source of changes; this enhancer only reflects them.

## Limitations

- Does not support partial updates. The entire content is replaced on every render. Do not attach event listeners to elements inside the summary — they are destroyed on every re-render.
- Does not render until `cartStore.totals` is populated. If the cart takes time to initialize, the element is blank until the first cart response arrives.
- Default template is fixed — subtotal, discounts, shipping, tax, total rows in that order. To change the order, wording, or add custom rows, use a custom `<template>`.
- `{line.price}`, `{line.priceTotal}`, and related campaign-data fields are only populated when the cart store has enriched the summary lines with campaign data. If campaign data is unavailable, these fields render as empty strings.
- List containers require a `<template>` child to define the row markup. A container without a `<template>` child is silently ignored.
- Emits no events. If another component needs to react to cart total changes, subscribe to `cartStore` directly.
