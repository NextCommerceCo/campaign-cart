# Use Cases

## Quantity stepper on a cart item row

> Effort: lightweight

**When:** A cart item list shows each package with a quantity indicator and the user should be able to adjust it directly on the cart page or in a cart drawer, without navigating elsewhere.

**Why this enhancer:** The enhancer binds directly to the cart store and handles the API write, disabled state, and processing feedback with no custom JavaScript. The three-element pattern (decrease button, display span, increase button) is a single HTML block inside the `CartItemListEnhancer` template.

**Watch out for:** `CartItemListEnhancer` re-renders the entire item list on every cart update, destroying and reinitialising all child enhancers. Do not attach additional event listeners to the button elements outside the enhancer lifecycle — they will be lost on re-render.

---

## Quantity input field in a cart drawer

> Effort: lightweight

**When:** The cart UI uses a text or number input to show and accept the quantity rather than +/- buttons — common in B2B flows where users order larger quantities and typing is faster than stepping.

**Why this enhancer:** `data-next-quantity="set"` on an `<input type="number">` or `<select>` element gives built-in clamping, cart API writes on `change`/`blur`, and automatic value reset on API error.

**Watch out for:** Setting `data-min="0"` (the default) allows the user to type 0, which removes the item from cart. If removing an item from the input is undesirable, set `data-min="1"` and pair with a separate `RemoveItemEnhancer` button.

---

## Quantity select dropdown

> Effort: lightweight

**When:** Quantity options are constrained to a small set (e.g., 1–5 only) and a dropdown is the appropriate UI pattern.

**Why this enhancer:** Using `data-next-quantity="set"` on a `<select>` element works identically to a number input — the cart is updated on `change` and the selected value is kept in sync with the cart store.

**Watch out for:** The enhancer does not populate `<option>` elements — the developer must write them in HTML with the correct `value` attributes matching valid quantity integers.

---

## When NOT to use this

### Adding a package to an empty cart

**Why not:** `QuantityControlEnhancer` only updates quantity for items already in the cart. If the package is not in the cart, `getItemQuantity` returns 0 and clicking increase will attempt to call `updateQuantity(packageId, 1)`, which may fail or have no effect depending on the API.

**Use instead:** `AddToCartEnhancer` — handles adding a package to the cart for the first time.

### Toggling a package on or off

**Why not:** A toggle pattern (add if absent, remove if present) is a different intent. Using an increase/decrease pair for this is confusing UX and does not handle the "add if absent" case.

**Use instead:** `PackageToggleEnhancer` — designed for checkbox-style package selection.
