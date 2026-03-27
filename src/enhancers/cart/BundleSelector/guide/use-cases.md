# Use Cases

## Multi-quantity product bundles (starter / value / family pack)

> Effort: lightweight

**When:** The campaign sells the same product in different quantities (1 bottle, 3 bottles, 6 bottles). Each tier is a separate package in the backend. The visitor should pick one tier and the cart should update immediately.

**Why this enhancer:** Each "tier" is a bundle containing a single `BundleItem` with the appropriate `quantity`. Selecting a tier atomically swaps the previous tier's cart item with the new one. The visitor never ends up with two quantities of the same product in the cart at once.

**Watch out for:** If each quantity tier is a genuinely separate package with a different `ref_id` (not just quantity=1 of the same package), set `quantity: 1` in the bundle items and use the tier-specific package ID. If the same package with quantity 3 means adding it once with qty=3, set `packageId` to that package and `quantity: 3`.

---

## Mixed-product bundles (product + accessory)

> Effort: lightweight

**When:** The campaign sells a product alongside optional accessories as pre-defined combos — e.g., "Main Product" alone, "Main Product + Case", "Main Product + Case + Charger". Each combo is a fixed set.

**Why this enhancer:** Each combo is a bundle card with multiple `BundleItem` entries (one per SKU). The enhancer handles the multi-item cart write atomically — no risk of partial state where the main product is swapped but the accessory is not yet added.

**Watch out for:** All packages in a bundle must exist in the campaign data. If one package is missing from the API response, that slot renders blank and the price may be incorrect. Confirm all package IDs are included in the campaign.

---

## Configurable bundles with per-unit variant selection

> Effort: moderate

**When:** The visitor buys multiple units but can choose a different variant (color, size) for each unit independently — e.g., "3 T-Shirts: pick a color for each one."

**Why this enhancer:** Setting `configurable: true` on a `BundleItem` with `quantity: 3` expands it into three individual slots, each with its own variant selector. The enhancer resolves the correct package for each slot's selected attributes and syncs the cart.

**Watch out for:** All variant packages for the product must be in the campaign data. If some variants are excluded, those options appear unavailable. Also, expanded slots increase the number of distinct cart items — each resolved variant becomes a separate line. Confirm the backend can handle the resulting item count.

---

## Bundles with auto-applied discount vouchers

> Effort: lightweight

**When:** Each bundle tier has its own discount code — e.g., the 3-pack auto-applies `SAVE10` and the 6-pack auto-applies `SAVE20`. The discount should switch when the visitor changes their bundle selection.

**Why this enhancer:** Declare `data-next-bundle-vouchers` on each card or in the `data-next-bundles` JSON. The enhancer applies the new bundle's vouchers and removes the previous bundle's vouchers automatically on every selection change.

**Watch out for:** Vouchers shared by two bundles are not removed when switching between them. If you need a voucher to apply only for one specific bundle, make sure it is not declared on any other bundle card. Do not manage these vouchers separately via `CouponEnhancer` — it will conflict with the automatic apply/remove logic.

---

## Savings display with retail compare price

> Effort: lightweight

**When:** The campaign shows crossed-out retail prices and a savings amount per bundle to create urgency.

**Why this enhancer:** `[data-next-bundle-price="compare"]`, `[data-next-bundle-price="savings"]`, and `[data-next-bundle-price="savingsPercentage"]` are populated automatically after each price fetch. Savings is calculated against `price_retail` from the campaign package data, not a manually entered value.

**Watch out for:** If packages do not have `price_retail` set in the backend, savings elements will show `$0` or `0%`. Verify retail prices are configured in the campaign.

---

## When NOT to use this

### Adding optional extras alongside a fixed base product

**Why not:** If the visitor can independently add or remove extras (e.g., toggle a warranty, add a second accessory), the bundle model — where selecting a bundle replaces the entire previous selection — is the wrong tool.

**Use instead:** `PackageToggleEnhancer` per optional extra. Each toggle independently adds or removes its item from the cart without disrupting other items.

### Picking a single package from a set with no bundling

**Why not:** If each card represents one package with one quantity and there are no multi-item bundles, the overhead of bundle item JSON is unnecessary.

**Use instead:** `PackageSelectorEnhancer` — it is purpose-built for single-package selection and integrates directly with `AddToCartEnhancer` via `data-next-selector-id`.

### Post-purchase upsell offer selection

**Why not:** `BundleSelectorEnhancer` writes to the cart store. Post-purchase flows write to the order via the order API, not the cart.

**Use instead:** `PackageSelectorEnhancer` with `data-next-upsell-context`, wired to `AcceptUpsellEnhancer` or `UpsellEnhancer`.
