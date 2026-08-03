---
title: "Features/Cart/Add to Cart/Attributes"
group: "Features"
category: "Add to Cart"
---

# Attributes

<!-- Generated from the feature manifest. Do not edit by hand:
     edit <feature>.manifest.ts, then run `npm run docs:reference`. -->

Adds a package to the cart on click — either a fixed package or whatever a linked selector currently has selected.

Turned on by `[data-next-action="add-to-cart"]`.

## `data-next-action`

| | |
|---|---|
| Type | `string` |
| Required | yes |
| Default | — |

Must be `"add-to-cart"`. This is the activation attribute — without it the feature is never instantiated.

**Valid values:**

- `add-to-cart` — Turns this element into an add-to-cart button.

---

## `data-next-package-id`

| | |
|---|---|
| Type | `number` |
| Required | no |
| Default | — |

The package `ref_id` to add on click. Use this for a button that always adds the same package, regardless of any selector on the page.

> **Watch out:** Set either `data-next-package-id` or `data-next-selector-id`. With neither, the click logs `No package ID available for add-to-cart action` and nothing is written to the cart.

---

## `data-next-selector-id`

| | |
|---|---|
| Type | `string` |
| Required | no |
| Default | — |

The selector id of a package selector, cart selector, or bundle selector on the page. The button reads that selector's current selection at click time and adds the selected package.

The button stays disabled until the linked selector has a selection.

> **Watch out:** The selector element is looked up up to 5 times at 50ms intervals after init. If it is still missing, the button logs `Selector "{id}" not found after retries` and never enables.

---

## `data-next-quantity`

| | |
|---|---|
| Type | `number` |
| Required | no |
| Default | `1` |

How many units to add. When a selector is linked, a quantity carried by the selected item wins over this value.

---

## `data-next-url`

| | |
|---|---|
| Type | `string` |
| Required | no |
| Default | — |

Where to send the visitor after a successful add. Query parameters from the current page URL are preserved and merged into the target, so attribution and test-mode flags survive the hop.

---

## `data-next-clear-cart`

| | |
|---|---|
| Type | `string` |
| Required | no |
| Default | `false` |

When `"true"`, the whole cart is emptied before the new item is added. Use it for single-item flows and "replace and buy" CTAs.

**Valid values:**

- `true` — Empty the cart first, then add.
- `false` — Add alongside whatever is already in the cart.

---

## `data-next-property-container`

| | |
|---|---|
| Type | `string` |
| Required | no |
| Default | — |

A CSS selector for an element wrapping custom-property inputs — engraving text, gift messages, a chosen colour. Every `[data-next-property]` input inside it is collected and attached to the cart line on add, and re-synced whenever the visitor edits one.

## Read from other elements

These are not placed on the element this feature is bound to — look for them on inputs elsewhere in the page, or on a linked selector.

| Name | Values | Meaning |
|---|---|---|
| `data-next-property` | — | Put on an input, textarea, or select **inside** `data-next-property-container`. Its value becomes the named property on the cart line. Empty inputs are skipped. |
| `data-next-default-property` | — | Put on an input anywhere in the document. Collected for every add-to-cart button on the page, no container needed. Container properties override defaults with the same key. |
| `data-next-selection-mode` | — | Read from the *linked selector*, not from the button. In `select` mode the button also accepts a selection carried purely in the DOM, so it enables without waiting for a selection event. |
| `data-selected-package / data-selected-bundle` | — | Read from the *linked selector* as the DOM fallback for the current selection when no in-memory selection is available yet — for example on a page that renders with a pre-selected card. |

## Set by the feature

Written to the element as state changes. Read these from CSS or tests instead of inferring state from the rendered text.

| Name | Values | Meaning |
|---|---|---|
| `disabled` | — | Present while a linked selector has no selection, and for the duration of the cart write. Style it, or the visitor can queue duplicate adds. |
| `aria-busy` | `true` / `false` | Set while the cart write is in flight, so the wait is announced. |

## CSS classes

Toggled by the feature. Style these rather than tracking the same state yourself.

| Name | Values | Meaning |
|---|---|---|
| `next-disabled` | — | Mirrors the `disabled` attribute while the button has nothing to add. |
| `loading` | — | The cart write is in flight. |
| `next-loading` | — | Namespaced twin of `loading`, for styling that must not collide with page CSS. |

## Conflicts

- `package-selector` in `swap` mode — a swap-mode selector writes to the cart itself on every selection, so pairing it with a button that also writes produces two cart writes per click. Use swap mode without a button, or put the selector in select mode and let the button do the writing.
