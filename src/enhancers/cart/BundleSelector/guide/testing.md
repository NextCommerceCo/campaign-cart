# Testing

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

> **Key behavior:** Items are always tagged and filtered by `ctx.selectorId` (the selector instance's
> `data-next-selector-id`). All cards within the same selector share this ID, so swapping any card
> correctly replaces only that selector's items without touching items from other selectors.

### Guard & error behavior (cases 7–9)

| # | Case | Condition | Expected behavior |
|---|------|-----------|-------------------|
| 7 | Guard — already applying | `isApplyingRef.value = true` before call | `swapCart` never called; `isApplyingRef` stays `true` |
| 8 | Error — `swapCart` throws, `previous` exists | API rejects | `selectCard(previous)` called; `isApplyingRef.value = false` after |
| 9 | Error — `swapCart` throws, `previous = null` | API rejects | selected card loses `next-selected` class + `data-next-selected="false"`; `isApplyingRef.value = false` after |

> **Test file:** `src/enhancers/cart/BundleSelector/tests/applyBundle.test.ts`
