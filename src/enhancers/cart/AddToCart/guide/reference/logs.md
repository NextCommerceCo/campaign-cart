# Logs

> This enhancer logs under the prefix: `[AddToCartEnhancer]`

## Healthy output

When running correctly in selector-linked mode you should see:

```
[AddToCartEnhancer] AddToCartEnhancer initialized { packageId: undefined, selectorId: "main", quantity: 1, redirectUrl: undefined, clearCart: false }
[AddToCartEnhancer] Redirecting to: https://example.com/checkout?utm_source=...
```

---

## Debug

### `AddToCartEnhancer initialized { ... }`

**When:** `initialize()` completes successfully.

**Meaning:** Expected behavior. Confirms the attribute values that were read. Check this first if the button is not working as expected — the log shows exactly what the enhancer understood from the HTML.

---

### `Clearing cart before adding item`

**When:** `data-next-clear-cart="true"` is set and the button is clicked.

**Meaning:** Expected behavior. The cart is about to be emptied.

---

### `Redirecting to: {url}`

**When:** `data-next-url` is set and the cart write succeeded.

**Meaning:** Expected behavior. The browser will navigate to the resolved URL.

---

## Warn

### `Selector "{selectorId}" not found after retries`

**When:** `data-next-selector-id` is set but no matching selector element was found on the page after 5 retries (250 ms total).

**Meaning:** The button may remain permanently disabled. Check that the selector element has the correct `data-next-selector-id` value and that it is present in the DOM.

**Action:** Verify the `data-next-selector-id` values match exactly on both elements. If the selector initializes late (e.g., inside a tab), ensure the button is not rendered before the selector.

---

### `No package ID available for add-to-cart action`

**When:** The button is clicked but no package ID can be resolved — neither `data-next-package-id` is set nor does the linked selector have an active selection.

**Meaning:** The cart write is skipped silently. This should not happen in normal use because the button is disabled when no selection exists. If you see this, the button state and the selector state are out of sync.

**Action:** Check that `updateButtonState` is being called when the selector changes. Verify the selector emits `selector:selection-changed` correctly.
