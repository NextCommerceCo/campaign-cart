# Logs

> This enhancer logs under the prefix: `RemoveItemEnhancer`

## Healthy output

When running correctly on a page with the package in the cart you should see:

```
[RemoveItemEnhancer] Initialized for package 42
```

After a successful removal:

```
[RemoveItemEnhancer] Removed item 42 from cart
```

---

## Debug

### `Initialized for package {packageId}`

**When:** `initialize()` completes without error.

**Meaning:** Expected behavior. The enhancer is bound, the cart subscription is active, and the button state reflects the current cart.

---

### `Item {packageId} not in cart, nothing to remove`

**When:** The click handler fires but `cartStore.getItemQuantity()` returns 0 at the time of the call.

**Meaning:** Expected in race conditions where the item was already removed between the click and the handler executing (e.g., another enhancer or external code removed it first). No API call is made.

---

### `Removed item {packageId} from cart`

**When:** `cartStore.removeItem()` resolves successfully.

**Meaning:** Expected behavior. The item has been removed and `cart:item-removed` has been emitted.
