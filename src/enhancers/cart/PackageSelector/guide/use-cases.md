# Use Cases

## Quantity-tiered product offer (1-pack, 3-pack, 6-pack)

> Effort: lightweight

**When:** A campaign offers the same product in multiple quantity bundles, each with its own price. The user picks one bundle and it goes straight to the cart.

**Why this enhancer:** Swap mode handles the mutual exclusivity and cart sync automatically. The dev only marks up cards with `data-next-package-id`. No button logic needed.

**Watch out for:** All three package IDs must exist in the campaign data returned by the API. If a package ID is missing, the card is registered with no name or price, and price slots stay blank.

---

## Variant selection (size, color, format)

> Effort: moderate

**When:** A product has variants (e.g., sizes S/M/L) where each variant maps to a different package. The user picks a variant before clicking Add to Cart.

**Why this enhancer:** Select mode (`data-next-selection-mode="select"`) lets the selector track the chosen variant without touching the cart. A single `AddToCartEnhancer` button wired via `data-next-selector-id` does the cart write.

**Watch out for:** Do not use swap mode here. If a user quickly clicks through variants in swap mode, each click fires a cart write, resulting in multiple API calls and possible race conditions.

---

## Post-purchase upsell package picker

> Effort: moderate

**When:** After checkout, a page offers an upsell with several package options. The user picks one and confirms via an Accept Upsell button.

**Why this enhancer:** `data-next-upsell-context` forces select mode and disables all cart operations. The `AcceptUpsellEnhancer` reads `_getSelectedPackageId()` to know which package to submit.

**Watch out for:** Do not omit `data-next-upsell-context`. Without it, swap mode is active and clicking a card will attempt to write to the cart store, which is not appropriate post-purchase.

---

## Auto-rendered cards from campaign data

> Effort: lightweight

**When:** The set of packages is dynamic (configured per campaign) and you do not want to hard-code card HTML. The template handles layout and the enhancer fills in values from the campaign store.

**Why this enhancer:** The `data-next-packages` + `data-next-package-template-id` auto-render path generates and registers cards at init. No server-side rendering or JS outside the SDK is needed.

**Watch out for:** The template must produce exactly one root element containing `[data-next-selector-card]`. If the template has multiple root elements, only the first is used and the rest are discarded.

---

## Selector driving a conditional display

> Effort: lightweight

**When:** Part of the page (e.g., a feature list, a product image) should change when the user picks a different package.

**Why this enhancer:** `ConditionalDisplayEnhancer` and `SelectionDisplayEnhancer` both call `_getSelectedItem()` on the selector container. They react to `selector:selection-changed` events automatically.

**Watch out for:** Both display enhancers must have `data-next-selector-id` pointing at this selector's ID, not the container element ID.

---

## When NOT to use this

### You need multiple packages selected simultaneously

**Why not:** The selector enforces single-selection. Clicking any card deselects all others.

**Use instead:** `PackageToggleEnhancer` — one instance per package, each independently toggleable.

### You need a true on/off toggle for a single optional add-on

**Why not:** A selector with one card is valid but unusual, and there is no "deselect all" state. The single card will always be selected.

**Use instead:** `PackageToggleEnhancer` — purpose-built for a single binary add/remove action.

### You need a multi-package bundle (e.g., product + warranty)

**Why not:** The selector writes one package at a time. It cannot atomically add a bundle of packages as a group.

**Use instead:** `BundleSelectorEnhancer` — handles multiple packages per selection, including voucher attachment.
