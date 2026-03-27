# BundleSelectorEnhancer — Voucher Guide

Vouchers (coupon codes) can be tied to bundle cards so they are automatically
applied and removed as the user switches between bundles.

---

## How it works

1. A bundle card declares its voucher codes via `data-next-bundle-vouchers`.
2. When the user clicks a card, `applyVoucherSwap(previous, next)` runs:
   - Removes the previous card's vouchers that are **not** shared with the new card.
   - Adds the new card's vouchers that are **not already present**.
3. The codes land in `checkoutStore.vouchers` and `cartStore.calculateTotals()`
   is called immediately so prices update.
4. Bundle price previews re-fetch 150 ms after any voucher change (debounced).
5. On checkout submission, all codes in `checkoutStore.vouchers` are sent with
   the order.

---

## Declaring vouchers on a bundle card

### Inline HTML — comma-separated (simplest)

```html
<div
  data-next-bundle="starter"
  data-next-bundle-vouchers="SAVE10"
>…</div>
```

### Inline HTML — JSON array (multiple codes)

```html
<div
  data-next-bundle="premium"
  data-next-bundle-vouchers='["SAVE20", "FREESHIP"]'
>…</div>
```

### JSON template (when bundles are rendered from `data-next-bundle-template`)

```json
{
  "id": "premium",
  "items": [{ "packageId": 42, "quantity": 1 }],
  "vouchers": ["SAVE20", "FREESHIP"]
}
```

The renderer writes the `data-next-bundle-vouchers` attribute automatically.

---

## Pre-selected bundle

The enhancer applies the pre-selected card's vouchers during `initialize()`,
before the user interacts with the page:

```
initialize()
  → find card with data-next-pre-selected
  → applyVoucherSwap(null, preSelectedCard)
  → calculateTotals()
```

No extra markup is needed — just mark the default card as pre-selected.

---

## Interaction with user-entered coupons

When fetching **price previews** for each bundle card, the enhancer distinguishes
between bundle vouchers and user-entered coupons:

```
allBundleVouchers = union of vouchers across all cards
userCoupons       = checkoutStore.vouchers − allBundleVouchers
merged            = userCoupons ∪ thisCard.vouchers   (deduped)
```

This ensures the preview price for each card reflects:
- The user's manually entered coupon, AND
- That specific card's bundle discount.

User coupons are **never** removed by bundle switching.

---

## State persistence — vouchers are saved to sessionStorage

`checkoutStore` persists `vouchers` to `sessionStorage` so both user-entered
coupons and bundle vouchers survive a page refresh.

Bundle vouchers are also re-applied by `BundleSelectorEnhancer.initialize()`
(via the pre-selected card flow), but `applyVoucherSwap` guards against
duplicates — if the code is already in state it is skipped:

```ts
if (!current.includes(code)) checkoutStore.addVoucher(code);
```

So a page refresh is safe: persisted bundle codes stay, the enhancer silently
skips re-adding them, and user-entered coupons are preserved as well.

---

## Common mistakes

| Mistake | Problem | Fix |
|---|---|---|
| Managing bundle vouchers via `CouponEnhancer` separately | Voucher is added twice; removing via the enhancer leaves a duplicate | Let `BundleSelectorEnhancer` own bundle vouchers — don't add them manually |
| Using the same code on multiple bundle cards | Code is never removed when switching between those cards (correct behaviour, but may be surprising) | This is intentional — shared codes stay applied |
| Removing `vouchers` from `partialize` in `checkoutStore` | User-entered coupons are lost on page refresh; only bundle vouchers survive (via enhancer init) | Keep `vouchers` in `partialize` |
| Calling `cartStore.applyCoupon()` for bundle vouchers | Applies uppercase normalisation and duplicate guard but also updates `appliedCoupons` display list, which will show internal bundle codes to the user | Use `checkoutStore.addVoucher()` directly for bundle-internal codes |

---

## Data flow diagram

```
User clicks bundle card
        │
        ▼
handleCardClick()
        │
        ├─ applyVoucherSwap(prev, next)
        │       │
        │       ├─ checkoutStore.removeVoucher(old codes)
        │       └─ checkoutStore.addVoucher(new codes)
        │
        └─ (swap mode) applyBundle() → cartStore API
                │
                ▼
        cartStore.calculateTotals()
                │
                ▼
        calculateCart({ vouchers: checkoutStore.vouchers })
                │
                ▼
        API → updated totals → cartStore state

checkoutStore.vouchers change (150 ms debounce)
        │
        ▼
fetchAndUpdateBundlePrice() for each card
        │
        ├─ merged = userCoupons ∪ card.vouchers
        └─ calculateBundlePrice({ vouchers: merged })
                │
                ▼
        price preview updated on card element

Order submission
        │
        ▼
CheckoutFormEnhancer reads checkoutStore.vouchers
        └─ sent as `vouchers: [...]` in order payload
```

---

## Related files

| File | Role |
|---|---|
| `BundleSelectorEnhancer.handlers.ts` | `applyVoucherSwap`, `handleCardClick` |
| `BundleSelectorEnhancer.price.ts` | `fetchAndUpdateBundlePrice` — merges user + bundle vouchers for preview |
| `BundleSelectorEnhancer.ts` | `parseVouchers`, card registration, voucher-change subscription |
| `BundleSelectorEnhancer.types.ts` | `BundleCard.vouchers`, `BundleDef.vouchers` |
| `src/stores/checkoutStore.ts` | `addVoucher`, `removeVoucher`, `vouchers` state (not persisted) |
| `src/utils/calculations/CartCalculator.ts` | `calculateCart`, `calculateBundlePrice` — voucher-aware cache key |
| `src/enhancers/checkout/CheckoutFormEnhancer.ts` | Reads `checkoutStore.vouchers` at submission |
