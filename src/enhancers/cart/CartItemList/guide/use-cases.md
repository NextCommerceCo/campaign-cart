# Use Cases

## Editable cart drawer or sidebar

> Effort: lightweight

**When:** The page has a slide-out cart panel that shows all items the user has added, with inline quantity controls and remove buttons.

**Why this enhancer:** It renders one row per cart item, auto-initializes quantity and remove controls inside each row, and keeps the list live as the cart changes — all from a single HTML element.

**Watch out for:** Do not attach JavaScript event listeners to elements inside the rendered rows. The entire `innerHTML` is replaced on every cart update. Use `data-next-quantity` and `data-next-remove-item` attributes for interactive controls — the enhancer handles their initialization automatically.

---

## Cart review step before checkout

> Effort: lightweight

**When:** A dedicated cart review page shows all items before the user proceeds to checkout. Items are read-only (no quantity change) but a remove action is available.

**Why this enhancer:** The same template mechanism works for read-only layouts — simply omit the `data-next-quantity` buttons from the template. The enhancer still keeps the list in sync reactively.

**Watch out for:** If you omit quantity controls but the user can add more of the same item elsewhere on the page (e.g., via `PackageSelectorEnhancer`), the list updates automatically. No manual refresh is needed.

---

## Grouped bundle display

> Effort: moderate

**When:** A bundle adds multiple packages to the cart (e.g., main product + accessory). You want to show each package as a separate line, but the same product in multiple quantities should appear as a single collapsed row.

**Why this enhancer:** `data-group-items` collapses cart lines with the same `packageId` into one row and sums their quantities. This avoids duplicate rows when the same package is added multiple times.

**Watch out for:** Grouping is display-only. The cart store still holds individual lines — `QuantityControlEnhancer` targets `packageId`, so adjusting quantity on a grouped row affects the total quantity for that package across all grouped lines.

---

## Custom title overrides for specific packages

> Effort: lightweight

**When:** Some packages need a display name different from the title stored in the campaign. For example, a bundle item named "Bundle — Main Product" should appear as "Main Product" in the cart.

**Why this enhancer:** `data-title-map` accepts a JSON object mapping package IDs to custom titles. The mapped title replaces `{item.name}` and `{item.title}` in the template.

**Watch out for:** The title map is read once at initialization. If you need dynamic title changes, use `window.nextConfig.productTitleTransform` instead — it is called per-render. Errors inside `productTitleTransform` are silently swallowed; the original title is used as the fallback.

---

## When NOT to use this

### Displaying cart totals (subtotal, shipping, total)

**Why not:** `CartItemListEnhancer` renders per-item rows. It has no access to aggregate totals.

**Use instead:** `CartSummaryEnhancer` — renders subtotal, discounts, shipping, and grand total from the cart store, with optional custom template.

### Displaying a single cart item in a fixed element

**Why not:** This enhancer renders a list and replaces its full content on every update. It is not designed for a single fixed element that maps to one specific package.

**Use instead:** `CartDisplayEnhancer` or `ConditionalDisplayEnhancer` — reads specific fields from the cart store and updates a fixed element reactively.

### Post-purchase order items

**Why not:** Post-purchase items live in `orderStore`, not `cartStore`. `CartItemListEnhancer` subscribes only to the cart store.

**Use instead:** `OrderItemListEnhancer` — renders items from the order store using the same template token pattern.
