# Glossary

## Cart write

A call to the cart API that modifies the cart state — adding, removing, or replacing items. `AddToCartEnhancer` performs exactly one cart write per click.

---

## Clear cart

The behavior triggered by `data-next-clear-cart="true"`. All existing items are removed from the cart before the new package is added. Used in single-item or "replace and buy" flows.

---

## Direct mode

When `data-next-package-id` is set on the button with no `data-next-selector-id`. The package to add is fixed and known at initialization time. The button is always enabled.

---

## Profile override

A named profile applied to the session before the cart write. Set via `data-next-profile`. Switches the active product set or pricing tier for the remainder of the session.

---

## Selector-linked mode

When `data-next-selector-id` is set on the button. The enhancer reads which package the customer has selected in the linked `PackageSelectorEnhancer` and adds that package on click. The button is disabled until a selection exists.

---

## Selector ID

The unique string value of `data-next-selector-id` shared between a `PackageSelectorEnhancer` and an `AddToCartEnhancer` on the same page. This string is how the button locates and reads from the selector.
