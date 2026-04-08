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

**Why this enhancer:** The `data-summary-lines` container renders one element per cart line using the enriched `SummaryLine` data, which includes campaign-sourced fields like `{item.image}` and `{item.name}` alongside API pricing fields.

**Watch out for:** `{item.image}` and `{item.name}` come from campaign data. If campaign data is not loaded, these fields render as empty strings. Lines are sorted by `package_id` ascending — if your design requires a different sort order, you cannot change it without modifying the enhancer. Note: the legacy `{line.*}` token set is deprecated and renders as empty strings — always use `{item.*}` in new templates.

```html
<div data-next-cart-summary>
  <template>
    <ul data-summary-lines>
      <template>
        <li class="line-item">
          <img src="{item.image}" alt="{item.name}" />
          <div class="line-details">
            <span class="line-name">{item.name}</span>
            <span class="line-qty">{item.quantity} × {item.unitPrice}</span>
          </div>
          <span class="line-total">{item.price}</span>
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

## Show a discount amount and percentage row

> Effort: lightweight

**When:** The summary needs a dedicated row that highlights the total discount applied — both as an absolute amount and as a percentage of subtotal — and hides itself when no discount is active.

**Why this enhancer:** `{totalDiscount}` and `{totalDiscountPercentage}` are built-in template tokens, and the `next-has-discounts` / `next-no-discounts` state classes let CSS hide the row when no discount is active without any JavaScript.

**Watch out for:** `{totalDiscountPercentage}` is rendered as a formatted percentage string (e.g. `"20%"`) — it is not a raw number. If you need the numeric value for calculations, use `data-next-display="cart.totalDiscountPercentage"` on a separate element.

```html
<div data-next-cart-summary>
  <template>
    <div class="summary-row"><span>Subtotal</span><span>{subtotal}</span></div>
    <div class="summary-row discount-row">
      <span>You save ({totalDiscountPercentage})</span>
      <span>-{totalDiscount}</span>
    </div>
    <div class="summary-row"><span>Shipping</span><span>{shipping}</span></div>
    <div class="summary-row total"><span>Total</span><span>{total}</span></div>
  </template>
</div>

<style>
  .next-no-discounts .discount-row { display: none; }
</style>
```

---

## Show a bulk-quantity badge only when an item has more than one unit

> Effort: lightweight

**When:** Each line in the summary should display an extra "×N" badge or "Bulk!" label, but only when the customer has more than one unit of that package. Lines with a single unit should render a clean row without the badge.

**Why this enhancer:** `data-next-show` works directly inside line templates against the `item.*` namespace. Conditions are evaluated per-line at render time and hidden elements are removed from the DOM, so you do not pay the cost of attaching a `ConditionalDisplayEnhancer` per line.

**Watch out for:** Use the no-braces syntax — write `item.quantity > 1`, not `{item.quantity} > 1`. The latter is substituted before evaluation and produces a malformed expression. Conditions referencing other namespaces (e.g. `cart.hasItems`) inside a line template are passed through to the global enhancer, which may thrash on frequent re-renders — keep cart-wide conditions outside the line template.

```html
<div data-next-cart-summary>
  <template>
    <ul data-summary-lines>
      <template>
        <li class="line-item">
          <span>{item.name}</span>
          <span class="bulk-badge" data-next-show="item.quantity > 1">×{item.quantity}</span>
          <span data-next-hide="item.hasDiscount">{item.price}</span>
          <span data-next-show="item.hasDiscount" class="strike">{item.originalPrice}</span>
          <span data-next-show="item.hasDiscount">{item.price}</span>
          <span data-next-show="item.isRecurring" class="renew">Renews {item.frequency}</span>
        </li>
      </template>
    </ul>

    <div class="summary-row total"><span>Total</span><span>{total}</span></div>
  </template>
</div>
```

---

## Show the final price with the original price struck through

> Effort: lightweight

**When:** A receipt-style summary should display the discounted unit price in bold, with the original price next to it as a strikethrough — but only when the line actually has a discount. Lines without a discount should render a single clean price.

**Why this enhancer:** `data-next-show="item.hasDiscount"` evaluates the boolean per row at render time, so the strikethrough markup is added only on discounted lines. The element is removed from the DOM (not just hidden), so screen readers and copy/paste do not pick up the original price on full-priced rows.

**Watch out for:** `{item.unitPrice}` is the discounted unit price; `{item.originalUnitPrice}` is the price before discounts. Both come from the API. If you want package totals instead of per-unit prices, use `{item.price}` and `{item.originalPrice}`.

```html
<div data-next-cart-summary>
  <template>
    <ul data-summary-lines>
      <template>
        <li class="line-item">
          <span class="name">{item.name}</span>
          <span class="qty">×{item.quantity}</span>
          <span class="price-current">{item.unitPrice}</span>
          <s class="price-original" data-next-show="item.hasDiscount">{item.originalUnitPrice}</s>
        </li>
      </template>
    </ul>

    <div class="summary-row total"><span>Total</span><span>{total}</span></div>
  </template>
</div>
```

---

## Show savings amount and percentage on each line

> Effort: lightweight

**When:** Discounted lines should display both the absolute savings (e.g. `−$5.00`) and the percentage off (e.g. `25% off`) so customers immediately see the value of the deal. Full-priced lines should hide both fields entirely.

**Why this enhancer:** Both `{item.discountAmount}` (currency) and `{item.discountPercentage}` (formatted percentage) are built-in tokens, and `data-next-show="item.hasDiscount"` removes the savings badge wrapper on lines without a discount in a single pass.

**Watch out for:** `{item.discountPercentage}` is a formatted string (e.g. `"25%"`) — the same value is exposed as a raw number to the condition evaluator. Use `data-next-show="item.discountPercentage >= 20"` if you want the badge to appear only when the discount is meaningful, not on a 1% rounding error.

```html
<div data-next-cart-summary>
  <template>
    <ul data-summary-lines>
      <template>
        <li class="line-item">
          <div class="line-info">
            <span class="name">{item.name}</span>
            <span class="qty">×{item.quantity}</span>
          </div>

          <div class="line-savings" data-next-show="item.hasDiscount">
            <span class="savings-amount">−{item.discountAmount}</span>
            <span class="savings-pct">{item.discountPercentage} off</span>
          </div>
        </li>
      </template>
    </ul>

    <div class="summary-row total"><span>Total</span><span>{total}</span></div>
  </template>
</div>
```

---

## Combine final price, original price, savings, and per-unit price into one rich row

> Effort: moderate

**When:** A flagship checkout receipt should expose the full pricing story for each line — final line total, struck-through original total, savings amount and percentage, and per-unit pricing — but only render the discount fields when the line is actually discounted.

**Why this enhancer:** All seven `item.*` price tokens (`{item.price}`, `{item.originalPrice}`, `{item.unitPrice}`, `{item.originalUnitPrice}`, `{item.discountAmount}`, `{item.discountPercentage}`, plus `{item.hasDiscount}` as the gate) come from the same API summary calculation, so the numbers are guaranteed to add up. `data-next-show="item.hasDiscount"` and `data-next-hide="item.hasDiscount"` together produce a clean two-column "regular" / "on sale" layout without any JavaScript.

**Watch out for:** Heavy templates re-render on every cart change. Keep the markup flat — avoid nesting more than one or two `data-next-show` levels deep so the per-row processing stays cheap. If you have many lines and a slow phone, prefer hiding wrappers (one condition per row) over hiding individual `<span>`s (many conditions per row).

```html
<div data-next-cart-summary>
  <template>
    <ul data-summary-lines>
      <template>
        <li class="line-item">
          <img src="{item.image}" alt="{item.name}" />

          <div class="line-details">
            <span class="name">{item.name}</span>
            <span class="qty">{item.quantity} × {item.unitPrice}</span>
            <span class="qty-original" data-next-show="item.hasDiscount">
              was {item.originalUnitPrice} per unit
            </span>
          </div>

          <div class="line-pricing">
            <span class="line-total">{item.price}</span>
            <s class="line-original" data-next-show="item.hasDiscount">{item.originalPrice}</s>
            <span class="line-savings" data-next-show="item.hasDiscount">
              You save {item.discountAmount} ({item.discountPercentage})
            </span>
          </div>
        </li>
      </template>
    </ul>

    <div class="summary-row"><span>Subtotal</span><span>{subtotal}</span></div>
    <div class="summary-row" data-next-show="cart.totalDiscount > 0">
      <span>Total savings</span><span>−{totalDiscount} ({totalDiscountPercentage})</span>
    </div>
    <div class="summary-row"><span>Shipping</span><span>{shipping}</span></div>
    <div class="summary-row total"><span>Total</span><span>{total}</span></div>
  </template>
</div>
```

The cart-wide `data-next-show="cart.totalDiscount > 0"` on the "Total savings" row sits *outside* the line template, so it is processed once by the global `ConditionalDisplayEnhancer` rather than per-line.

---

## When NOT to use this

### Displaying a single cart value in isolation (e.g., just the total in a header badge)

**Why not:** CartSummaryEnhancer renders a full block of content. Using it to show one value means wrapping everything in a template just to extract a single token.

**Use instead:** `CartDisplayEnhancer` — binds a single `{token}` to any element. More appropriate for standalone values like a running total in a sticky header or a badge count.

### Displaying cart line items in an editable cart drawer

**Why not:** CartSummaryEnhancer re-renders the entire `innerHTML` on every change and does not support event listeners on its children. You cannot wire up quantity controls or remove buttons inside a summary line.

**Use instead:** `CartItemListEnhancer` — renders editable cart lines and auto-initializes `QuantityControlEnhancer` and `RemoveItemEnhancer` on each line after every render.
