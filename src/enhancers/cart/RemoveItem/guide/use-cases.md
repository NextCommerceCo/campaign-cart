# Use Cases

## Remove button on a static cart item row

> Effort: lightweight

**When:** The page has a fixed set of cart item rows hard-coded in HTML (not rendered by `CartItemListEnhancer`). Each row shows one package and needs its own remove button.

**Why this enhancer:** Each button is bound to a single `data-package-id`. The enhancer auto-disables when the item is already gone and re-enables if the item is added back, with no extra JS required.

**Watch out for:** If the same package appears in multiple rows (e.g. a featured item and a cart summary), each element needs its own `data-next-remove-item` instance. They all subscribe to the same cart store, so state is always in sync.

---

## Remove button inside a `CartItemListEnhancer` template

> Effort: lightweight

**When:** Cart items are rendered dynamically by `CartItemListEnhancer`. Each rendered row needs a remove button.

**Why this enhancer:** `CartItemListEnhancer` auto-initialises `RemoveItemEnhancer` on any `[data-next-remove-item]` element it renders after each cart update. The `data-package-id` is stamped by the template using `{item.packageId}`.

**Watch out for:** Do not attach your own event listeners to elements inside `CartItemListEnhancer` templates — the entire `innerHTML` is replaced on every cart update. Let `CartItemListEnhancer` own the lifecycle.

---

## Remove with confirmation dialog

> Effort: lightweight

**When:** The product is high-value or the removal is hard to undo, and the team wants to prevent accidental taps on mobile.

**Why this enhancer:** `data-next-confirm="true"` adds a native browser confirmation prompt before the API call is made. No extra code required.

**Watch out for:** The native `confirm()` dialog cannot be styled or branded. If the design requires a custom modal, manage the confirmation flow externally and call `cartStore.removeItem()` directly — do not use `data-next-confirm` in that case.

---

## When NOT to use this

### Removing all items from the cart at once

**Why not:** `RemoveItemEnhancer` targets a single `packageId`. Removing all items requires iterating the full cart.

**Use instead:** Call `useCartStore.getState().clearCart()` directly (or wire a custom button to that action).

### Removing a full bundle

**Why not:** A bundle consists of multiple packages. Removing one `packageId` leaves the rest of the bundle in the cart.

**Use instead:** `BundleSelectorEnhancer` — it handles atomic bundle removal including synced vouchers.
