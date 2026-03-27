# Use Cases

## Show a running cart total during checkout

> Effort: lightweight

**When:** A campaign page has a multi-step flow and the right-hand sidebar needs to show the current cart cost at all times — subtotal, shipping, and total — updating live as the user adds or removes items.

**Why this enhancer:** Drop in `data-next-cart-summary` and it updates automatically whenever the cart changes. No JavaScript required from the template author.

**Watch out for:** The element is blank until the cart is initialized. Place a loading skeleton behind `next-cart-empty` so the sidebar does not appear broken on first load.

```html
<div data-next-cart-summary></div>
```

---

## Display a discount breakdown with individual offer and voucher rows

> Effort: lightweight

**When:** The order summary should show each active discount on its own line (e.g., "Bundle deal — -$10.00", "Coupon SAVE20 — -$5.00") rather than a single combined "Discounts" total.

**Why this enhancer:** The `data-summary-offer-discounts` and `data-summary-voucher-discounts` containers render one row per discount using the API's discount data. CSS classes `next-has-discounts` / `next-no-discounts` can hide the section when there are no active discounts.

**Watch out for:** Both containers require a `<template>` child. A container without one is silently skipped. Voucher discounts only appear after a coupon is applied — the voucher list will be empty until then.

```html
<div data-next-cart-summary>
  <template>
    <div class="summary-row"><span>Subtotal</span><span>{subtotal}</span></div>

    <div class="discount-section">
      <ul data-summary-offer-discounts>
        <template><li class="discount-item">{discount.name} — -{discount.amount}</li></template>
      </ul>
      <ul data-summary-voucher-discounts>
        <template><li class="discount-item coupon">{discount.name}: -{discount.amount}</li></template>
      </ul>
    </div>

    <div class="summary-row"><span>Shipping</span><span>{shipping}</span></div>
    <div class="summary-row total"><span>Total</span><span>{total}</span></div>
  </template>
</div>
```

---

## Show per-line item breakdown with product images and pricing

> Effort: moderate

**When:** The summary should render a receipt-style list — one row per package, showing the product image, name, quantity, and line total — before the order totals.

**Why this enhancer:** The `data-summary-lines` container renders one element per cart line using the enriched `SummaryLine` data, which includes campaign-sourced fields like `{line.image}` and `{line.name}` alongside API pricing fields.

**Watch out for:** `{line.image}` and `{line.name}` are only populated when the cart store has enriched lines with campaign data. If campaign data is not loaded, these fields render as empty strings. Lines are sorted by `package_id` ascending — if your design requires a different sort order, you cannot change it without modifying the enhancer.

```html
<div data-next-cart-summary>
  <template>
    <ul data-summary-lines>
      <template>
        <li class="line-item">
          <img src="{line.image}" alt="{line.name}" />
          <div class="line-details">
            <span class="line-name">{line.name}</span>
            <span class="line-qty">{line.qty} × {line.unitPrice}</span>
          </div>
          <span class="line-total">{line.total}</span>
        </li>
      </template>
    </ul>

    <div class="summary-row"><span>Subtotal</span><span>{subtotal}</span></div>
    <div class="summary-row"><span>Shipping</span><span>{shipping}</span></div>
    <div class="summary-row total"><span>Total</span><span>{total}</span></div>
  </template>
</div>
```

---

## Show savings and compare-at pricing

> Effort: lightweight

**When:** The checkout summary should show what the customer is saving — a "You save $X" row or a strikethrough compare-at total — to reinforce the deal.

**Why this enhancer:** `{savings}` and `{compareTotal}` are built-in template tokens. The `next-has-savings` / `next-no-savings` state classes let you hide the savings row when no savings are available.

**Watch out for:** `{savings}` includes both retail (compare-at) savings and applied discounts. If you want to show only retail savings, there is no separate token — use `{compareTotal}` alongside `{total}` and let the user compute the difference visually.

```html
<div data-next-cart-summary>
  <template>
    <div class="summary-row"><span>Retail total</span><span class="strike">{compareTotal}</span></div>
    <div class="summary-row savings-row"><span>You save</span><span>{savings}</span></div>
    <div class="summary-row"><span>Shipping</span><span>{shipping}</span></div>
    <div class="summary-row total"><span>Total</span><span>{total}</span></div>
  </template>
</div>

<style>
  .next-no-savings .savings-row { display: none; }
</style>
```

---

## When NOT to use this

### Displaying a single cart value in isolation (e.g., just the total in a header badge)

**Why not:** CartSummaryEnhancer renders a full block of content. Using it to show one value means wrapping everything in a template just to extract a single token.

**Use instead:** `CartDisplayEnhancer` — binds a single `{token}` to any element. More appropriate for standalone values like a running total in a sticky header or a badge count.

### Displaying cart line items in an editable cart drawer

**Why not:** CartSummaryEnhancer re-renders the entire `innerHTML` on every change and does not support event listeners on its children. You cannot wire up quantity controls or remove buttons inside a summary line.

**Use instead:** `CartItemListEnhancer` — renders editable cart lines and auto-initializes `QuantityControlEnhancer` and `RemoveItemEnhancer` on each line after every render.
