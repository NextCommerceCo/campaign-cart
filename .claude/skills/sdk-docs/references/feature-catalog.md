# Feature Catalog Template

The catalog answers the newcomer's **first** question — *"what can this SDK do?"* —
as a scannable map, not an alphabetical class list. One catalog for the whole SDK
(docs homepage / a `features` index). Covers sdk-docs §1.

> Source of truth for "which attribute activates which feature": the
> `data-next-*` → feature mapping in `src/core/attribute-scanner.ts`. Derive the
> catalog from there so it never drifts from what actually runs. Categories come
> from `src/features/README.md` (cart, checkout, display, order, ui, behavior).

---

## Template

````md
# What the SDK can do

Add `data-next-*` attributes to your HTML; the SDK wires up the behavior on load.
Start with the **core** features — the rest are optional enhancements.

## Cart  (core)

| Feature | Turn it on with | What it does |
|---------|-----------------|--------------|
| [Add to cart](../features/cart/add-to-cart/guide/overview.md) | `data-next-action="add-to-cart"` | Adds a package to the cart |
| [Package selector](…) | `data-next-selector-id` | Pick one package from a group |
| [Quantity control](…) | `data-next-quantity` | Adjust an item's quantity |
| [Coupon](…) | `data-next-coupon` | Apply/remove a discount code |

## Display  (core)

| Feature | Turn it on with | What it does |
|---------|-----------------|--------------|
| [Cart display](…) | `data-next-display="cart.*"` | Show live cart values (total, count…) |
| [Product display](…) | `data-next-display="package.*"` | Show package price/name/image |

## Checkout · Order · UI · Behavior  (optional)

…one row per feature, same shape…
````

## Rules

- **Core vs optional** is mandatory — a reader must see the handful that matter
  before the long tail.
- **One line of value per feature**, in product terms ("apply a discount code",
  not "wraps CouponEnhancer").
- **Lead with the attribute** — that's the thing a developer types.
- Every row links to the feature's `guide/overview.md` (question 2), not to
  TypeDoc.
- Keep it flat and current: when a feature is added/removed or its activating
  attribute changes, update this catalog in the same change (the `guide.md` sync
  rule extends here).

## How to build it

1. Read `src/core/attribute-scanner.ts` → list every `data-next-*` it matches and
   the feature it instantiates.
2. Group by category (`src/features/README.md`).
3. Mark the everyday ones (add-to-cart, selectors, cart/product display,
   checkout form) as **core**; the rest optional.
4. One row each; link to each `guide/overview.md`.
