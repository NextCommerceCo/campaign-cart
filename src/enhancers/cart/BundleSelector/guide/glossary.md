# Glossary

## Bundle

A named, pre-defined set of products and quantities offered together as a single selectable option. A bundle is defined by the developer; the visitor picks one bundle at a time. Examples: "Starter (1 bottle)", "Value (3 bottles)", "Main Product + Case + Charger".

---

## Bundle card

The DOM element representing one bundle option. Marked with `data-next-bundle-card`. Contains the bundle's display content (name, price, slots) and the machine-readable bundle definition in `data-next-bundle-items`.

---

## Bundle item

One entry in a bundle's item list. Specifies a `packageId` and a `quantity`. Can be marked `configurable` (expand into per-unit slots) or `noSlot` (add to cart silently without rendering).

---

## Bundle voucher

A coupon or discount code declared on a specific bundle card. Applied automatically when the bundle is selected and removed when a different bundle is selected. Not the same as a user-entered coupon — bundle vouchers are managed by the enhancer, not the visitor.

---

## Configurable item

A bundle item with `configurable: true` set. When its `quantity` is greater than 1, each unit becomes a separate slot so the visitor can choose a different variant (size, color) per unit.

---

## noSlot item

A bundle item with `noSlot: true` set. Its package is added to the cart when the bundle is selected but no slot row is rendered in the UI. Used for free gifts, silent add-ons, or items the visitor should not configure.

---

## Slot

One rendered row in a bundle's slot list, representing a single unit of a product within the bundle. Slots are rendered from the `slotTemplate`. A configurable item with `quantity: 3` produces three slots.

---

## Swap mode

The default operating mode (`data-next-selection-mode="swap"`). When the visitor selects a bundle, the enhancer immediately writes the change to the cart — removing the previous bundle's items and adding the new bundle's items. The cart is the source of truth.

---

## Select mode

Operating mode set via `data-next-selection-mode="select"`. The enhancer tracks which bundle is selected but does not write to the cart. An external button or action performs the cart write. Used when a page layout requires an explicit "Add to Cart" step.

---

## Effective items

The actual set of packages and quantities the bundle will add to the cart after accounting for any variant overrides. If a visitor changes a slot's variant, the `activePackageId` for that slot changes; effective items reflects those changes, not the original bundle definition.

---

## Variant

A product attribute combination that identifies a specific package — e.g., Color=Red + Size=L. Each variant is a separate package in the campaign. Variant selection within a slot resolves to the matching package by comparing attribute values.
