# Order Enhancers

Post-purchase pages (thank-you, upsell pages). Interact with `orderStore` rather than `cartStore`.

## Files

| File | Class | Attribute |
|---|---|---|
| `UpsellEnhancer.ts` | `UpsellEnhancer` | `data-next-upsell="offer"` |
| `OrderItemListEnhancer.ts` | `OrderItemListEnhancer` | `data-next-order-items` |

---

## UpsellEnhancer

Manages post-purchase upsell offers. Adds packages to an **existing completed order** via `orderStore.addUpsell()` API call.

### Two modes

**Direct mode** — single fixed package:
```html
<div data-next-upsell="offer" data-next-package-id="55">
  <span data-next-display="package.name"></span>
  <span data-next-display="package.price"></span>
  <button data-next-upsell-action="add" data-next-url="/upsell-2">Yes, Add This!</button>
  <button data-next-upsell-action="skip" data-next-url="/thank-you">No Thanks</button>
</div>
```

**Selector mode** — user picks from multiple options:
```html
<div data-next-upsell="offer" data-next-selector-id="protection">
  <div data-next-selector-id="protection">
    <div data-next-upsell-option data-next-package-id="55">Basic</div>
    <div data-next-upsell-option data-next-package-id="56" data-next-selected="true">Premium</div>
  </div>
  <button data-next-upsell-action="add" data-next-url="/upsell-2">Add Selected</button>
  <button data-next-upsell-action="skip" data-next-url="/thank-you">Skip</button>
</div>
```

### Container attributes
| Attribute | Description |
|---|---|
| `data-next-upsell="offer"` | Required on container |
| `data-next-package-id` | Direct mode — the package to add |
| `data-next-selector-id` | Selector mode — ID of the option group |
| `data-next-quantity` | Default quantity (default 1) |

### Action buttons (`data-next-upsell-action`)
| Value | Behavior |
|---|---|
| `add` / `accept` | Calls `orderStore.addUpsell()`, then navigates to `data-next-url` |
| `skip` / `decline` | Skips (no API call), navigates to `data-next-url` |

URL fallback: if no `data-next-url` on button, reads `<meta name="next-upsell-accept-url">` or `<meta name="next-upsell-decline-url">`.

### Option cards (selector mode)
```html
<div data-next-upsell-option data-next-package-id="55">Option A</div>
```
Or `<select data-next-upsell-select="selectorId">` with `<option value="55">` elements.

`data-next-selected="true"` — pre-selected option on load.

### Quantity controls
```html
<button data-next-upsell-quantity="decrease">-</button>
<span data-next-upsell-quantity="display">1</span>
<button data-next-upsell-quantity="increase">+</button>

<!-- Card-style quantity selector -->
<div data-next-upsell-quantity-toggle="1">1 Unit</div>
<div data-next-upsell-quantity-toggle="2">2 Units</div>

<!-- Link quantity control to specific selector (for cross-container sync) -->
<button data-next-upsell-quantity="increase" data-next-quantity-selector-id="protection">+</button>
```

### Behavior
- Only shown/enabled when `orderStore.canAddUpsells()` is true
- Duplicate detection: if package was already added (in `orderStore.completedUpsells`), shows a confirmation modal before adding again
- Shows full-page `LoadingOverlay` during API call
- Handles browser back-nav via `pageshow` event (resets loading state)
- Preserves `ref_id` and session params in all redirects
- Tracks page views via `<meta name="next-page-type" content="upsell">` (once per URL path)

### Cross-container sync
Multiple `UpsellEnhancer` instances with the same `data-next-selector-id` on the same page automatically sync:
- Option selection state
- Quantity values

### CSS classes managed
`next-processing`, `next-available`, `next-hidden`, `next-success`, `next-error`, `next-skipped`

### Events
| Event | When |
|---|---|
| `upsell:initialized` | On init |
| `upsell:viewed` | On upsell page view (once per path, only on `meta[name="next-page-type"]` pages) |
| `upsell:adding` | Before API call |
| `upsell:added` | After successful API call |
| `upsell:error` | On API error |
| `upsell:skipped` | On skip action |
| `upsell:quantity-changed` | When quantity changes |
| `upsell:option-selected` | When an option is selected |
| `upsell-selector:item-selected` | Legacy alias for option-selected |

---

## OrderItemListEnhancer

Renders order line items from `orderStore` using a template. Auto-loads order from URL `?ref_id=` parameter.

```html
<div data-next-order-items data-item-template-id="order-item-tmpl">
  <!-- replaced by rendered items -->
</div>

<script id="order-item-tmpl" type="text/html">
  <div class="item">
    <img src="{item.image}" alt="{item.name}">
    <span>{item.name}</span>
    <span>Qty: {item.quantity}</span>
    <span>{item.lineTotal|currency}</span>
  </div>
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
| `data-empty-template` | HTML shown when order has no items |

### Available template tokens (`{item.xxx}`)

**Basic:** `id`, `name`/`title`, `sku`, `quantity`

**Pricing (formatted):**
`price` (unit incl tax), `priceExclTax`, `lineTotal`, `lineTotalExclTax`

**Pre-discount pricing:**
`priceExclDiscounts`, `priceExclTaxExclDiscounts`, `lineTotalExclDiscounts`, `lineTotalExclTaxExclDiscounts`

**Discount amounts:** `unitDiscount`, `lineDiscount`

**Taxes:** `unitTax`, `lineTax`

**Product:** `image`, `description`, `variant`, `upsellBadge`

**Boolean flags:** `isUpsell`, `hasImage`, `hasDescription`, `hasVariant`, `hasTax`, `hasDiscount`

**Conditional CSS helpers:** `showUpsell`, `showImage`, `showDescription`, `showVariant`, `showTax`, `showDiscount`

### CSS classes managed
`order-loading`, `order-has-items`, `order-empty`, `order-error`
