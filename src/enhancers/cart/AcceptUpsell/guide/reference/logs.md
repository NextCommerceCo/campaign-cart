# Logs

> This enhancer logs under the prefix: `[AcceptUpsellEnhancer]`

## Healthy output

When running correctly on a page with a valid order you should see:

```
[AcceptUpsellEnhancer] Initialized { packageId: 42, selectorId: undefined, quantity: 1 }
```

On click (with redirect):
```
[AcceptUpsellEnhancer] Using fallback URL from <meta name="next-upsell-accept-url">: /upsell-2
```

---

## Debug

### `Initialized { packageId, selectorId, quantity }`

**When:** `initialize()` completes.

**Meaning:** Expected. Confirms the enhancer read its attributes and set up its subscriptions. `selectorId` is `undefined` when using a direct package ID.

### `Using fallback URL from <meta name="next-upsell-accept-url">: {url}`

**When:** `data-next-url` is not set but a `<meta name="next-upsell-accept-url">` tag is present.

**Meaning:** Expected. The redirect URL came from the meta tag, not the attribute.

### `Using fallback URL from <meta name="next-upsell-decline-url">: {url}`

**When:** The duplicate dialog was cancelled, `data-next-url` is not set, and a `<meta name="next-upsell-decline-url">` tag is present.

**Meaning:** Expected. The decline redirect URL came from the meta tag.

---

## Info

### `User confirmed to add duplicate upsell`

**When:** The duplicate confirmation dialog was shown and the user clicked "Yes, Add Again".

**Meaning:** Expected. The upsell will be submitted a second time.

### `User declined to add duplicate upsell`

**When:** The duplicate confirmation dialog was shown and the user clicked "Skip to Next".

**Meaning:** Expected. The upsell is not submitted again. The user is navigated to the decline URL if one is configured.

---

## Warn

### `Selector "{selectorId}" not found`

**When:** `data-next-selector-id` is set but no matching selector element exists in the DOM after the 100 ms initialization delay.

**Meaning:** The linked `PackageSelectorEnhancer` was not initialized or the `data-next-selector-id` values do not match. The button will stay disabled because no package can be resolved from the selector.

**Action:** Verify the `data-next-selector-id` values match exactly between the button and the selector container. Confirm the selector container has `data-next-package-selector` and is present in the DOM before the enhancer initializes.

### `No package ID available for accept-upsell action`

**When:** The button was clicked but neither `data-next-package-id` nor a selector selection resolved to a package ID.

**Meaning:** No package to submit. The click is silently ignored. This can happen if the selector has not yet received a selection event.

**Action:** Ensure `data-next-package-id` is set, or that the linked selector has a pre-selected card (`data-next-selected="true"`).

---

## Error

### `No order loaded`

**When:** The button was clicked but `orderStore.order` is null.

**Meaning:** The order has not loaded yet or has been cleared. The click is silently ignored.

**Action:** Confirm the page URL contains a valid `?ref_id=` parameter and that `orderStore.loadOrder()` has been called by the SDK initializer.

### `Failed to accept upsell: {error}`

**When:** `orderStore.addUpsell()` throws.

**Meaning:** The API call failed. The loading overlay is dismissed immediately. The error is rethrown and the `action:failed` event is emitted.

**Action:** Check the network tab for the API response. Common causes: the order no longer supports upsells server-side, the package ID is invalid, or the session has expired.
