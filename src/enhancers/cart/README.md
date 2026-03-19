# Cart Enhancers

Handles package selection, adding/removing items, quantity control, and cart item rendering.

## Files

| File | Class | Attribute |
|---|---|---|
| `PackageSelectorEnhancer.ts` | `PackageSelectorEnhancer` | `data-next-selector` / `data-next-cart-selector` |
| `AddToCartEnhancer.ts` | `AddToCartEnhancer` | `data-next-action="add-to-cart"` |
| `CartToggleEnhancer.ts` | `CartToggleEnhancer` | `data-next-toggle` |
| `CartItemListEnhancer.ts` | `CartItemListEnhancer` | `data-next-cart-items` |
| `QuantityControlEnhancer.ts` | `QuantityControlEnhancer` | `data-next-quantity="increase\|decrease\|set"` |
| `RemoveItemEnhancer.ts` | `RemoveItemEnhancer` | `data-next-remove-item` |
| `AcceptUpsellEnhancer.ts` | `AcceptUpsellEnhancer` | `data-next-action="accept-upsell"` |

---

## PackageSelectorEnhancer

Manages a group of package option cards. Handles selection and (in swap mode) automatically updates the cart.

### Modes
- **`swap`** (default) — selecting a card immediately replaces the current cart item
- **`select`** — selecting a card marks it but does NOT add to cart (pair with `AddToCartEnhancer`)

### HTML structure
```html
<div data-next-cart-selector data-next-selector-id="main" data-next-selection-mode="select">
  <div data-next-selector-card data-next-package-id="10" data-next-selected="true">...</div>
  <div data-next-selector-card data-next-package-id="20">...</div>
</div>
```

### Key attributes

**Container:**
- `data-next-selector-id` — ID used to link with `AddToCartEnhancer`
- `data-next-selection-mode="select"` — enable select mode (default: swap)

**Card (`data-next-selector-card`):**
- `data-next-package-id` (required)
- `data-next-quantity` — cart quantity for this card (default 1)
- `data-next-selected="true"` — pre-selected on load
- `data-next-shipping-id` — set shipping method when selected (swap mode only)
- `data-next-min-quantity` / `data-next-max-quantity` — quantity control bounds
- `data-next-quantity-increase` / `data-next-quantity-decrease` — +/- buttons inside card
- `data-next-quantity-display` — element to show current quantity text

### CSS classes managed
- `next-selector-card` — added to every card on init
- `next-selected` — currently selected card
- `next-in-cart` — card whose package is in cart

### Events emitted
- `selector:item-selected` — on card click
- `selector:selection-changed` — after internal selection state updates
- `selector:quantity-changed` — when a card's quantity control changes

### Exposed on element (for AddToCartEnhancer)
- `element._getSelectedItem()` → `SelectorItem | null`
- `element._getSelectedPackageId()` → `number | undefined`
- `element.getAttribute('data-selected-package')` → package ID string

---

## AddToCartEnhancer

Button that adds a package to the cart. Works in two modes:

**Direct mode** — adds a fixed package:
```html
<button data-next-action="add-to-cart" data-next-package-id="10">Buy Now</button>
```

**Selector mode** — adds whatever is selected in a `PackageSelectorEnhancer`:
```html
<button data-next-action="add-to-cart" data-next-selector-id="main" data-next-url="/checkout">
  Add to Cart
</button>
```

### Attributes
| Attribute | Description |
|---|---|
| `data-next-package-id` | Direct package ID |
| `data-next-selector-id` | Read selection from this selector |
| `data-next-quantity` | Quantity to add (default 1) |
| `data-next-url` | Redirect here after success (query params preserved) |
| `data-next-clear-cart="true"` | Clear cart before adding |
| `data-next-profile` | Apply a profile before adding |

Button is disabled (`next-disabled`) when no selection is available in selector mode.

**Events emitted:** `cart:item-added`

---

## CartToggleEnhancer

Click-to-toggle button — adds when not in cart, removes when in cart. Useful for bumps, optional add-ons, and warranties.

```html
<button data-next-toggle data-next-package-id="99"
        data-add-text="Add Protection Plan"
        data-remove-text="Protection Plan Added">
  Add Protection Plan
</button>
```

### Attributes
| Attribute | Description |
|---|---|
| `data-next-package-id` | Package to toggle (on element or parent container) |
| `data-next-quantity` | Quantity (default 1) |
| `data-next-selected="true"` | Auto-add to cart on page load |
| `data-add-text` / `data-remove-text` | Button text based on cart state |
| `data-next-package-sync="2,4,9"` | Mirror quantity of listed packages (for warranties) |
| `data-next-qty-sync="123"` | Legacy single-package sync |
| `data-next-is-upsell="true"` | Mark as upsell item |

**Sync mode:** When `data-next-package-sync` is set, quantity automatically equals the total quantity of those packages in cart (e.g., one warranty per product unit). If synced packages are removed, the toggle item is removed too.

**State container detection:** walks up DOM to find `data-next-toggle-container`, `data-next-bump`, `data-next-upsell-item`, or any ancestor with `data-next-package-id`.

**CSS classes managed (on element and state container):**
`next-in-cart`, `next-not-in-cart`, `next-active`

---

## CartItemListEnhancer

Renders cart items using a template. Re-renders on every cart store update.

```html
<div data-next-cart-items data-item-template-id="cart-item-tmpl">
  <!-- content replaced by rendered items -->
</div>

<script id="cart-item-tmpl" type="text/html">
  <div class="item">{item.name} x{item.quantity} — {item.finalLineTotal|currency}</div>
</script>
```

### Template resolution (priority order)
1. `data-item-template-id="id"` → `document.getElementById(id).innerHTML`
2. `data-item-template-selector=".selector"` → `querySelector().innerHTML`
3. `data-item-template` attribute value
4. Element's own `innerHTML`
5. Built-in default template

### Attributes
| Attribute | Description |
|---|---|
| `data-empty-template` | HTML shown when cart is empty |
| `data-title-map='{"123":"My Label"}'` | Override product names per package ID |
| `data-group-items` | Merge duplicate packageId entries (adds quantities) |

### Available template tokens (`{item.xxx}`)

**Basic:** `id`, `packageId`, `name`, `title`, `quantity`, `image`, `sku`

**Pricing (formatted as currency by default):**
`price`, `unitPrice`, `lineTotal`, `comparePrice`, `unitComparePrice`, `recurringPrice`,
`savingsAmount`, `unitSavings`, `packageSavings`, `discountAmount`, `finalPrice`, `finalLineTotal`

**Percentages:** `savingsPct`, `packageSavingsPct`

**Variant:** `variantAttributesFormatted`, `variantAttributesList`, `variantSku`,
`variantColor`, `variantSize`, `variant.color`, `variant.size`, `variantAttr.color`, etc.

**Flags/strings:** `frequency`, `isRecurring`, `hasSavings`, `showCompare`, `showSavings`,
`showRecurring`, `showDiscount`, `showOriginalPrice`

**Raw numbers** (append `.raw`): `price.raw`, `lineTotal.raw`, `savingsAmount.raw`, etc.

After render, auto-initializes `QuantityControlEnhancer` and `RemoveItemEnhancer` on any `[data-next-quantity]` and `[data-next-remove-item]` elements in the rendered HTML.

---

## QuantityControlEnhancer

Controls cart item quantity. Applied to buttons (`increase`/`decrease`) or inputs/selects (`set`).

```html
<!-- Buttons -->
<button data-next-quantity="decrease" data-package-id="10" data-min="1">-</button>
<span>{quantity}</span>
<button data-next-quantity="increase" data-package-id="10" data-max="10">+</button>

<!-- Input -->
<input data-next-quantity="set" data-package-id="10" type="number" min="1">
```

### Attributes
| Attribute | Description |
|---|---|
| `data-next-quantity` | Action: `increase`, `decrease`, or `set` (required) |
| `data-package-id` | Package to control (required) |
| `data-step` | Step amount (default 1) |
| `data-min` | Minimum quantity (default 0 — removes at 0) |
| `data-max` | Maximum quantity (default 99) |

Setting quantity to 0 removes the item from cart. Buttons auto-disable at min/max bounds.

**Events emitted:** `cart:quantity-changed`

---

## RemoveItemEnhancer

Removes a package from the cart on click.

```html
<button data-next-remove-item data-package-id="10"
        data-confirm="true"
        data-confirm-message="Remove this item?">
  Remove
</button>
```

### Attributes
| Attribute | Description |
|---|---|
| `data-package-id` | Package to remove (required) |
| `data-confirm="true"` | Show browser `confirm()` dialog before removal |
| `data-confirm-message` | Custom confirmation message |

Disables itself when the package is not in cart. Adds `removing` class to parent `[data-cart-item-id]` or `.cart-item` element for CSS animations.

**Events emitted:** `cart:item-removed`

---

## AcceptUpsellEnhancer

Post-purchase upsell button. Adds a package to an **existing completed order** (not the cart). Used on upsell/one-click pages after checkout.

```html
<button data-next-action="accept-upsell"
        data-next-package-id="55"
        data-next-url="/upsell-2">
  Yes, Add This!
</button>
```

### Attributes
| Attribute | Description |
|---|---|
| `data-next-package-id` | Direct package ID |
| `data-next-selector-id` | Read selection from a UpsellEnhancer selector |
| `data-next-quantity` | Quantity (default 1) |
| `data-next-url` | Redirect after acceptance |

Falls back to `<meta name="next-upsell-accept-url">` / `<meta name="next-upsell-decline-url">` if no URL attribute is set.

- Shows a full-page `LoadingOverlay` during API call
- If package was already added (checked via `orderStore.completedUpsells`), shows a confirmation modal
- Handles browser back-nav via `pageshow` event (hides overlay)
- Only enabled when `orderStore.canAddUpsells()` is true

**Events emitted:** `upsell:accepted`

