# Glossary

## Card

A child element of the selector container, marked with `data-next-selector-card`, that represents one selectable package option. Each card maps to a single package ID.

---

## Pre-selection

The card designated as selected before the user interacts. Controlled by `data-next-selected="true"` on a card. On init, the first card with this attribute is pre-selected; if none is marked, the first card in the DOM is used.

---

## Selector ID

The unique string value of `data-next-selector-id` that identifies this selector instance. Other enhancers (`AddToCartEnhancer`, `AcceptUpsellEnhancer`, display enhancers) use this ID to look up the selector and call its `_getSelectedItem()` method.

---

## Swap mode

The default operating mode. Selecting a card immediately writes to the cart: the previously selected package is removed and the newly selected package is added in a single `swapPackage` call. The cart is the authoritative source of truth for which card appears selected.

---

## Select mode

An operating mode (`data-next-selection-mode="select"`) where clicking a card only updates visual state. No cart write occurs on card click. An external button (typically `AddToCartEnhancer`) is responsible for reading the selection and adding it to the cart.

---

## Upsell context

A mode flag (`data-next-upsell-context`) that marks the selector as part of a post-purchase upsell offer. Forces select mode. Cart store operations are disabled entirely. Prices are fetched with `upsell=true` so the API can return upsell-specific pricing.

---

## Package definition

A JSON object in the `data-next-packages` array that describes one card to auto-render. Minimum shape: `{ "packageId": 101 }`. Any extra keys (e.g., `"selected": true`, `"badge": "Best value"`) are exposed as `{package.key}` template variables.

---

## Template variable

A `{package.key}` placeholder in an auto-render template. Built-in variables (`{package.name}`, `{package.price}`, etc.) are filled from campaign store data. Custom variables come from the package definition object.

---

## Price slot

An element inside a card with a `data-next-package-price` attribute. The enhancer writes a formatted price into this element after fetching from the bundle price API. Multiple slots per card are supported, each showing a different price variant (total, compare-at, savings, etc.).

---

## Swap

The cart operation that atomically removes one package and adds another. Implemented via `cartStore.swapPackage(existingPackageId, newPackageOptions)`. Used in swap mode when the cart already contains a different selector package.
