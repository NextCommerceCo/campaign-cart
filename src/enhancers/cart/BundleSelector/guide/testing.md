# Testing

> Test file: `src/enhancers/cart/BundleSelector/tests/applyBundle.test.ts`

---

## Approach

`BundleSelectorEnhancer` splits its cart-write logic into plain exported functions
(`applyBundle`, `applyEffectiveChange`, `applyVoucherSwap`, `onVoucherApplied`,
`applyVariantChange`). Because these are **not methods on a class**, they are tested
directly without mounting an enhancer or touching the DOM.

Handler tests focus on two things:

1. **What gets written to the cart** — the exact items array passed to `swapCart`.
2. **Error recovery** — that the UI reverts and `isApplyingRef` resets on failure.

E2E tests (Playwright) cover the full interaction cycle: card click → cart update → UI
feedback. Unit tests here are not a substitute for that; they cover the logic branch
paths that E2E cannot isolate cheaply.

---

## Mocking strategy

`cartStore` and `checkoutStore` are mocked at the module level via `vi.mock`. No real
Zustand store is instantiated — the tests control exactly what `getState()` returns.

```ts
vi.mock('@/stores/cartStore', () => ({
  useCartStore: { getState: vi.fn() },
}));
vi.mock('@/stores/checkoutStore', () => ({
  useCheckoutStore: { getState: vi.fn() },
}));
```

This is an exception to the project rule of testing with real store instances.
The exception is justified here because:

- `applyBundle` reads `cartStore.items` and calls `cartStore.swapCart` — it does not
  own the store state, it consumes it. A real store would require wiring up `swapCart`
  as an async action, adding API mock layers with no benefit.
- The assertions are about the **call arguments** to `swapCart`, not store state
  transitions — mocking the function directly is the clearest way to assert that.

---

## Helper functions

### `makeCard(bundleId, packageId?, quantity?)`

Creates a minimal `BundleCard` with a real DOM element (so class/attribute assertions
work), one item, and one slot. The element starts with `next-selected` and
`data-next-selected="true"` — the state before a card is deselected on error.

### `makeSlot(packageId, quantity?)`

Creates a `BundleSlot` with `slotIndex = 0`, `unitIndex = 0`, and `configurable = false`.
Use this when you need a slot that matches a specific packageId.

### `makeCtx(overrides?)`

Creates a `HandlerContext` with:

- `mode: 'swap'` — the swap path is what `applyBundle` exercises.
- `selectorId: 'selector-a'` — used to tag and filter cart items.
- `isApplyingRef: { value: false }` — starts unlocked.
- `selectCard`, `emit`, `fetchAndUpdateBundlePrice` all as `vi.fn()`.
- A real `containerElement` (div) and `externalSlotsEl: null`.

Pass `overrides` to change any field — e.g. `makeCtx({ isApplyingRef: { value: true } })`
for guard tests.

### `makeCartItem(packageId, quantity, selectorId?)`

Creates a minimal `CartItem`. Leave `selectorId` undefined to simulate items added by
`CartToggleEnhancer` or `PackageSelectorEnhancer` — these should never be stripped by
`applyBundle`.

### `mockCartStore(items, swapCart?)`

Configures `useCartStore.getState` to return the given items array and a `swapCart`
mock (defaults to `vi.fn().mockResolvedValue(undefined)`). Returns the `swapCart` spy
so you can assert call arguments directly.

---

## `applyBundle`

### Swap behavior (cases 1–6)

Assumes `ctx.selectorId = 'selector-a'`, `selected = card-b`, `packageId = 1`, `qty = 1`.

| # | Case | Cart items before | `swapCart` called with |
|---|------|-------------------|------------------------|
| 1 | Empty cart | `[]` | `[{ pkgId: 1, qty: 1, selectorId: 'selector-a' }]` |
| 2 | First select — stale same-selector items (`previous = null`) | `[{ pkgId: 1, qty: 1, selectorId: 'selector-a' }]` | `[{ pkgId: 1, qty: 1, selectorId: 'selector-a' }]` |
| 3 | Swap card — previous card has different packageId, same selector | `[{ pkgId: 2, qty: 1, selectorId: 'selector-a' }]` | `[{ pkgId: 1, qty: 1, selectorId: 'selector-a' }]` |
| 4 | Other selector's items in cart | `[{ pkgId: 5, qty: 1, selectorId: 'selector-b' }]` | `[{ pkgId: 5, qty: 1, selectorId: 'selector-b' }, { pkgId: 1, qty: 1, selectorId: 'selector-a' }]` |
| 5 | Toggle item (no `selectorId`) in cart | `[{ pkgId: 9, qty: 1, selectorId: undefined }]` | `[{ pkgId: 9, qty: 1, selectorId: undefined }, { pkgId: 1, qty: 1, selectorId: 'selector-a' }]` |
| 6 | Package selector item (no `selectorId`) in cart | `[{ pkgId: 7, qty: 2, selectorId: undefined }]` | `[{ pkgId: 7, qty: 2, selectorId: undefined }, { pkgId: 1, qty: 1, selectorId: 'selector-a' }]` |

> **Key behavior:** Items are always tagged and filtered by `ctx.selectorId` (the selector
> instance's `data-next-selector-id`). All cards within the same selector share this ID,
> so swapping any card correctly replaces only that selector's items without touching
> items from other selectors.

### Guard & error behavior (cases 7–9)

| # | Case | Condition | Expected behavior |
|---|------|-----------|-------------------|
| 7 | Guard — already applying | `isApplyingRef.value = true` before call | `swapCart` never called; `isApplyingRef` stays `true` |
| 8 | Error — `swapCart` throws, `previous` exists | API rejects | `selectCard(previous)` called; `isApplyingRef.value = false` after |
| 9 | Error — `swapCart` throws, `previous = null` | API rejects | selected card loses `next-selected` class + `data-next-selected="false"`; `isApplyingRef.value = false` after |

---

## `buildSlotVars` — slot price correctness

`buildSlotVars` in `BundleSelectorEnhancer.renderer.ts` derives per-slot price variables
from `pkgState.unitPrice × slot.quantity`, not from the aggregate `pkgState.price`
(which equals `line.total` — all units of that package combined).

Key cases to verify:

| Case | Setup | Expected `item.price` |
|------|-------|-----------------------|
| Single slot, qty 1 | `unitPrice = 10`, `slot.quantity = 1` | `$10.00` |
| Single slot, qty 2 (non-configurable) | `unitPrice = 10`, `slot.quantity = 2` | `$20.00` |
| 3 configurable slots, same package | `unitPrice = 10`, each `slot.quantity = 1` | `$10.00` per slot (not `$30.00`) |
| Discount applied | `originalUnitPrice = 15`, `unitPrice = 10`, `slot.quantity = 1` | `item.discountAmount = $5.00` |

The bug this guards against: before the fix, `item.price` used `pkgState.price`
(`line.total` from the calculate API), which is the aggregate for all units of that
package. With 3 configurable slots of the same package, each slot would show `$30`
instead of `$10`.

---

## Adding new tests

When adding a case:

1. Use `makeCard` / `makeCtx` / `mockCartStore` — do not inline object literals unless
   the test specifically needs a shape that the helpers cannot produce.
2. Assert the **full items array** passed to `swapCart` (length + contents), not just
   that `swapCart` was called — silent regressions on unrelated items are common.
3. Always assert `ctx.isApplyingRef.value` is `false` after the call completes, unless
   the test is specifically for the guard path (case 7).
