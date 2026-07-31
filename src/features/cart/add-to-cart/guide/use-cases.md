---
title: "Features/Cart/Add to Cart/Use Cases"
group: "Features"
category: "Add to Cart"
---

# Use Cases

## Single-product landing page with package variants

> Effort: lightweight

**When:** The page sells one product in multiple quantities or bundles. The customer picks a package from a list of cards, then clicks a single "Add to cart" button.

**Why this enhancer:** Pair `PackageSelectorEnhancer` in `select` mode with `AddToCartEnhancer` via `data-next-selector-id`. The selector tracks which card is chosen; the button reads the selection and performs one cart write on click.

**Watch out for:** Do not use `select` mode on a `PackageSelectorEnhancer` without pairing it with an `AddToCartEnhancer`. The selector does nothing with the selection on its own in that mode.

---

## Buy-now button that replaces the cart

> Effort: lightweight

**When:** A secondary CTA ("Buy now") should bypass any previously selected items and immediately add a specific package, then redirect to checkout.

**Why this enhancer:** Set `data-next-package-id`, `data-next-clear-cart="true"`, and `data-next-url` on the button. No selector needed. The cart is wiped and the specified package is added in a single action.

**Watch out for:** `data-next-clear-cart="true"` removes everything currently in the cart, including items added by other enhancers. Only use this on a dedicated "replace and buy" CTA, never on a standard add button.

---

## When NOT to use this

### Post-purchase upsell accept button

**Why not:** Post-purchase upsells write to the order API, not the cart store. `AddToCartEnhancer` only writes to `cartStore`.

**Use instead:** `AcceptUpsellEnhancer` — designed for post-purchase order writes with duplicate detection via `orderStore`.

### Toggling a package in and out of the cart

**Why not:** `AddToCartEnhancer` always adds. It does not check whether the item is already in the cart or remove it on a second click.

**Use instead:** `PackageToggleEnhancer` — handles the add/remove toggle pattern in a single button.
