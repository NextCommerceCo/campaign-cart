# Errors

## `handleCardClick failed`

| | |
|---|---|
| Type | Recoverable |
| Cause | `cartStore.addItem()` or `cartStore.removeItem()` threw an error (network failure, API error, or cart validation rejection). |

**Fix:**

The `next-loading` class is removed in the `finally` block, so the card is not left in a stuck loading state. The user can retry the click. Check the browser network tab for the failed API request and inspect the response for details.

---

## `handleUpsellCardClick failed:`

| | |
|---|---|
| Type | Recoverable |
| Cause | `orderStore.addUpsell()` threw an error. Common causes: the upsell window has closed, the API key is invalid, or the order ref_id is missing from the store. |

**Fix:**

The `next-loading` class is removed and `isProcessingRef.value` is reset to `false`, allowing the user to retry. Verify that `orderStore` has a valid order before the upsell page loads. If the error is consistent, check that `data-next-upsell-context` is only used on post-purchase pages where `orderStore` is populated.

---

## `No updated order returned`

| | |
|---|---|
| Type | Recoverable |
| Cause | `orderStore.addUpsell()` resolved but returned `null` or `undefined`. This typically means the order was not found or the API returned an unexpected shape. |

**Fix:**

This error is thrown inside `handleUpsellCardClick` and caught by its `try/catch`, so the enhancer recovers. The upsell add is not applied. Check that `orderStore` has a valid order with a `ref_id` before the user reaches the upsell page.

```ts
// Verify order is loaded before navigating to the upsell page
const order = useOrderStore.getState().order;
if (!order?.ref_id) {
  // do not show the upsell page
}
```
