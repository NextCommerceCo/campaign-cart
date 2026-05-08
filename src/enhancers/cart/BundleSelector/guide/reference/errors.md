# Errors

## `Error in applyBundle: <message>`

| | |
|---|---|
| Type | Recoverable |
| Cause | `cartStore.swapCart()` rejected during a bundle selection. Network error, API timeout, or invalid package ID in the bundle items. |

**Fix:**

1. Open browser DevTools → Network. Find the cart API request and check the response body for the error detail.
2. Confirm all `packageId` values in `data-next-bundle-items` are valid `ref_id` values that exist in the backend.
3. If the API is temporarily unavailable, the enhancer has already reverted the visual state — the user can retry by clicking the card again.

---

## `Error in applyEffectiveChange: <message>`

| | |
|---|---|
| Type | Recoverable |
| Cause | `cartStore.swapCart()` rejected while syncing the cart after a variant change on the currently selected bundle. The slot UI re-renders but the cart is not updated. |

**Fix:**

1. Check the cart API request in DevTools for the error detail.
2. The slot UI now shows the new variant but the cart still contains the old items. The cart syncs on the next user interaction (e.g., clicking the card again or reloading the page).
3. Same root causes as `Error in applyBundle` above.
