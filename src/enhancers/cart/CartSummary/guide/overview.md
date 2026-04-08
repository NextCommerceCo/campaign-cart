# CartSummaryEnhancer

> Category: `cart`
> Last reviewed: 2026-04-08
> Owner: campaign-cart

Two enhancers cover cart summary display:

- **`CartSummaryEnhancer`** — a reactive block that renders a full cart totals layout (subtotal, discounts, shipping, grand total) into a container element. Supports a built-in default layout or a fully custom `<template>`.
- **`CartDisplayEnhancer`** — renders a single cart value into any element, using `data-next-display="cart.{property}"`. Use this when you need individual values scattered across the page rather than a grouped block.

## Concept

Both enhancers subscribe to the cart store and are read-only observers — neither ever writes to the cart.

**`CartSummaryEnhancer`** rendering works in two paths depending on whether a `<template>` child is present:

- **Default path**: the enhancer generates a standard row layout (subtotal, discounts, shipping, total) using its built-in template. The discounts row is shown only when the discount amount is non-zero.
- **Custom path**: the enhancer uses the `<template>` child's markup as the layout. Token replacement (`{subtotal}`, `{total}`, etc.) fills in the formatted values. List containers for line items and discount breakdowns are wired up after token replacement.

In both paths, state CSS classes are applied to the host element on every render so CSS can show or hide rows conditionally (e.g. `.next-no-discounts .discount-row { display: none }`).

```
cartStore update
      │
      ├─► CartSummaryEnhancer
      │         │
      │   handleCartUpdate()
      │   ├── totals changed?
      │   ├── summary changed?
      │   └── item count changed?
      │         │
      │         YES → render()
      │               ├── buildFlags(totals)       → SummaryFlags
      │               ├── buildVars(totals, flags) → TemplateVars
      │               ├── updateStateClasses()     → apply CSS classes to host
      │               └── customTemplate?
      │                   ├── YES → renderCustom() → token replacement + list containers
      │                   └── NO  → renderDefault() → built-in row layout
      │
      └─► CartDisplayEnhancer (one instance per element)
                │
          getPropertyValue()  → raw value from cartStore
                │
          BaseDisplayEnhancer → format → set element textContent
```

## Business logic

- Renders only after the cart store has been hydrated. Before the cart is initialized (`cartState` undefined), the element is empty.
- Re-renders on every change to `totals`, `summary`, item count, or `isCalculating` — not on every store tick. Reference equality is used to skip unnecessary renders.
- While a totals recalculation is in progress, `isCalculating` is `true` and the host element gets the `next-calculating` class. When recalculation completes, `next-not-calculating` is applied instead.
- Shipping is displayed as "Free" when its value is zero. `{shippingOriginal}` is empty when no shipping discount is applied.
- Discounts combine offer and voucher discounts into a single `{totalDiscount}` total (`{discounts}` is kept as a backwards-compatible alias). Separate breakdown lists (`data-summary-offer-discounts`, `data-summary-voucher-discounts`) are available in custom templates.
- List containers (`data-summary-lines`, `data-summary-offer-discounts`, `data-summary-voucher-discounts`) replace their non-template children entirely on each render. Children are cleared and rebuilt from the list template.
- Line items are sorted by `package_id` ascending before rendering.
- `{line.*}` tokens are deprecated. Templates using `{line.*}` tokens will trigger a console warning listing the equivalent `{item.*}` replacement for each token, and the tokens will render as empty strings. Migrate to `{item.*}` tokens.
- `{item.hasDiscount}` outputs `"show"` or `"hide"` — intended as a CSS class or `data-` flag, not directly displayed. `{line.hasDiscount}` is a deprecated alias that triggers a console warning and renders as an empty string.
- `data-next-show` and `data-next-hide` are evaluated locally inside line and discount templates against the `item.*` and `discount.*` namespaces. Hidden elements are removed from the DOM at render time and their attributes are stripped, so the global `ConditionalDisplayEnhancer` never re-processes them. Conditions referencing other namespaces (e.g. `cart.*`) are passed through untouched and handled by the global enhancer.

## Decisions

- We chose to re-render the full `innerHTML` on every cart change rather than patching individual values because diffing template slots across arbitrary markup is fragile and error-prone. Full replacement is predictable.
- We chose to apply state CSS classes to the host element rather than requiring separate `ConditionalDisplayEnhancer` instances, because the most common use case is hiding/showing rows within the same block via CSS, not across elements.
- We chose a `<template>` child (not a `data-` attribute or external template ID) so that the layout is co-located with the element in the HTML, making it easier to read and maintain.
- We chose to separate `offer_discounts` and `voucher_discounts` into distinct list containers so that merchants can style them differently (e.g., different icons or labels) without parsing a combined string.
- We chose not to emit any events because this enhancer has no user-interactive state. Other enhancers writing to the cart are the source of changes; this enhancer only reflects them.

## Limitations

- Does not support partial updates. The entire content is replaced on every render. Do not attach event listeners to elements inside the summary — they are destroyed on every re-render.
- Does not render until the cart store is hydrated. If the cart takes time to initialize, the element is blank until the first cart response arrives.
- Default template is fixed — subtotal, discounts (when non-zero), shipping, total rows in that order. To change the order, wording, or add custom rows, use a custom `<template>`.
- The local `data-next-show` / `data-next-hide` evaluator does not support function calls (e.g. `item.hasFlag(x)`). Only property access, comparisons, and logical combinations are handled.
- `{line.*}` tokens render as empty strings in all cases and trigger a console deprecation warning. Use `{item.*}` tokens instead.
- List containers require a `<template>` child to define the row markup. A container without a `<template>` child is silently ignored.
- Emits no events. If another component needs to react to cart total changes, subscribe to `cartStore` directly.
