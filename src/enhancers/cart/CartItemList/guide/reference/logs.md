# Logs

> This enhancer logs under the prefix: `[CartItemListEnhancer]`

## Healthy output

When running correctly you should see:

```
[CartItemListEnhancer] CartItemListEnhancer initialized
[CartItemListEnhancer] Enhanced 2 quantity buttons and 2 remove buttons
```

After each cart update that changes item HTML:

```
[CartItemListEnhancer] Enhanced 2 quantity buttons and 2 remove buttons
```

After a cart update that does not change item HTML:

```
[CartItemListEnhancer] Cart items HTML unchanged, skipping DOM update
```

---

## Info

### `CartItemListEnhancer initialized`

**When:** `initialize()` completes successfully.

**Meaning:** The enhancer has read its configuration, subscribed to the cart store, and rendered the initial state. Expected on every page load.

---

## Debug

### `Cart items HTML unchanged, skipping DOM update`

**When:** The cart store emits an update (e.g. totals changed, coupon applied) but the rendered item HTML is identical to the previous render.

**Meaning:** Expected behavior — the enhancer skips the DOM write to avoid unnecessary layout work.

---

### `Enhanced {N} quantity buttons and {N} remove buttons`

**When:** After each render that writes new `innerHTML`.

**Meaning:** Expected behavior — confirms `QuantityControlEnhancer` and `RemoveItemEnhancer` were instantiated on the rendered controls.

---

## Warn

### `Invalid title map JSON:`

**When:** `data-title-map` contains a value that cannot be parsed as JSON.

**Meaning:** The title map attribute is malformed. The enhancer continues without it — all items render with their original campaign titles.

**Action:** Fix the JSON value in the `data-title-map` attribute. Ensure it is valid JSON (double-quoted keys, no trailing commas).

---

## Error

### `Failed to enhance quantity button:`

**When:** `QuantityControlEnhancer` throws during initialization on a rendered `[data-next-quantity]` element.

**Meaning:** That specific quantity button will not respond to clicks. Other buttons in the same render are unaffected.

**Action:** Check the button element for missing or malformed `data-package-id`. Verify `QuantityControlEnhancer` is importable.

---

### `Failed to enhance remove button:`

**When:** `RemoveItemEnhancer` throws during initialization on a rendered `[data-next-remove-item]` element.

**Meaning:** That specific remove button will not respond to clicks.

**Action:** Check the button element for missing `data-package-id`. Verify `RemoveItemEnhancer` is importable.

---

### `Error in handleCartUpdate:`

**When:** An unexpected error occurs while processing a cart store update.

**Meaning:** The render for this update was skipped. The displayed list may be stale until the next cart update triggers a successful render.

**Action:** Check the error message. Common causes: malformed template HTML, missing required imports.
