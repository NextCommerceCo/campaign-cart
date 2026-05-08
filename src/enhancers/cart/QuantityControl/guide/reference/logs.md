# Logs

> This enhancer logs under the prefix: `[QuantityControlEnhancer]`

## Healthy output

When a quantity button is clicked successfully you should see:

```
[QuantityControlEnhancer] Initialized for package 42, action: increase {min: 0, max: 99, step: 1}
[QuantityControlEnhancer] Updated 42 quantity to 3
```

When the user decreases to 0:

```
[QuantityControlEnhancer] Removed item 42 from cart
```

---

## Debug

### `Initialized for package {id}, action: {mode} {constraints}`

**When:** `initialize()` completes successfully.

**Meaning:** The enhancer is active and has read all required attributes. Expected behavior on page load.

---

### `Updated {packageId} quantity to {newQuantity}`

**When:** `updateQuantity` is called for an `increase` or `decrease` action.

**Meaning:** Cart API call succeeded. Expected behavior.

---

### `Removed item {packageId} from cart`

**When:** The new quantity after a step reaches 0 or below, or the user sets quantity to 0 in a `set` input. `removeItem` is called instead of `updateQuantity`.

**Meaning:** Expected behavior — item removed cleanly.

---

### `Quantity unchanged, skipping`

**When:** The new quantity after applying a step is identical to the current quantity. This happens when the user clicks `increase` at `max` or `decrease` at `min` while the disabled state briefly allows a click (race condition between a fast cart update and a click).

**Meaning:** No API call was made. Expected — no action needed.
