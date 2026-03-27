# Get Started

## Prerequisites

- The SDK must be initialized (`SDKInitializer` or `NextCommerce.init()`) so that `cartStore` is populated.
- The cart must have at least one item for totals to render. An empty cart renders nothing.

## Setup

### Option A — Default template

Drop a single element with `data-next-cart-summary`. The enhancer renders a built-in layout with subtotal, discounts (when non-zero), shipping, tax (when non-zero), and total rows.

```html
<div data-next-cart-summary></div>
```

### Option B — Custom template

Add a `<template>` child with your own markup. Use `{token}` placeholders for the values you want to display.

```html
<div data-next-cart-summary>
  <template>
    <div class="summary-row"><span>Subtotal</span><span>{subtotal}</span></div>
    <div class="summary-row discount-row"><span>Discounts</span><span>-{discounts}</span></div>
    <div class="summary-row"><span>Shipping</span><span>{shipping}</span></div>
    <div class="summary-row"><span>Total</span><span>{total}</span></div>
  </template>
</div>

<style>
  .next-no-discounts .discount-row { display: none; }
</style>
```

### Option C — Custom template with line items and discount lists

Inside a custom `<template>`, add list containers to render per-line breakdowns and discount details.

```html
<div data-next-cart-summary>
  <template>
    <ul data-summary-lines>
      <template>
        <li>
          <img src="{line.image}" alt="{line.name}" />
          <span>{line.name}</span>
          <span>{line.qty} × {line.unitPrice}</span>
          <span>{line.total}</span>
        </li>
      </template>
    </ul>

    <div class="summary-row"><span>Subtotal</span><span>{subtotal}</span></div>

    <ul data-summary-offer-discounts>
      <template><li>{discount.name} — -{discount.amount}</li></template>
    </ul>

    <ul data-summary-voucher-discounts>
      <template><li>{discount.name}: -{discount.amount}</li></template>
    </ul>

    <div class="summary-row"><span>Shipping</span><span>{shipping}</span></div>
    <div class="summary-row"><span>Total</span><span>{total}</span></div>
  </template>
</div>
```

## Verify it is working

After the SDK initializes and the cart contains at least one item, you should see:

- The summary element's content is populated with prices — not blank.
- Changing the cart (adding/removing items, applying a coupon) updates the displayed totals without a page reload.
- The host element has state classes: `next-cart-has-items`, `next-has-discounts` or `next-no-discounts`, `next-free-shipping` or `next-has-shipping`.
- In Option A, the discounts row is absent when no discount is active; the tax row is absent when tax is zero.
- In Option B, `.discount-row` is hidden when `next-no-discounts` is present on the host.

## Next steps

- All available `{token}` placeholders: [reference/attributes.md](./reference/attributes.md)
- Line item and discount object fields: [reference/object-attributes.md](./reference/object-attributes.md)
- Common use cases: [use-cases.md](./use-cases.md)
- How it relates to other enhancers: [relations.md](./relations.md)
