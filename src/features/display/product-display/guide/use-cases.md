---
title: "Features/Display/Product Display/Use Cases"
group: "Features"
category: "Product Display"
---

# Use Cases

## Reusable product card

> Effort: lightweight

**When:** You have a card component (name, price, image, retail strikethrough) that should work for any package.

**Why this enhancer:** Put `data-next-package-id` on the card and use shorthand paths (`package.name`, `package.price`) inside. The same markup renders any package by changing the ancestor id.

**Watch out for:** Without an ancestor id and without an id in the path, the element renders nothing and logs `No package context found`.

---

## "You save 40%" badges

> Effort: lightweight

**When:** You want to advertise savings versus the retail price.

**Why this enhancer:** Calculated properties — `savingsPercentage`, `savingsAmount`, `hasSavings` — are computed by `PriceCalculator` from the package's price/retail fields, no server call needed.

**Watch out for:** These are **retail-based** savings. Per-package *discount/coupon* breakdown is not available client-side (`discountAmount` is `0`); use the cart summary for coupon totals.

---

## Price that follows an upsell quantity

> Effort: moderate

**When:** On an upsell page with a quantity control, the shown price should reflect the chosen quantity.

**Why this enhancer:** `data-next-multiply-quantity` multiplies price properties by the live quantity, syncing to `upsell:quantity-changed` for the matching selector or package.

**Watch out for:** Match scope carefully — set `data-next-quantity-selector-id` to bind to a specific selector, or rely on package-id matching when there is no selector.

---

## Currency-aware pricing

> Effort: lightweight

**When:** The page lets the visitor switch currency.

**Why this enhancer:** It listens for `next:currency-changed`, reloads package data, and re-renders — so every price updates together.

**Watch out for:** Values come from the campaign data for the active currency; the enhancer does not convert amounts itself.

---

## When NOT to use this

### Showing live cart totals (subtotal, count, shipping)

**Why not:** This enhancer shows *package/campaign* data, not the cart.

**Use instead:** `CartDisplayEnhancer` (`data-next-display="cart.*"`) for live cart values.

### Showing order/receipt data after purchase

**Why not:** It reads the campaign, not the completed order.

**Use instead:** `OrderDisplayEnhancer` (`data-next-display="order.*"`).
