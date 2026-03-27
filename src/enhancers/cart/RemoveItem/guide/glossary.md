# Glossary

## Cart item

A single line in the cart representing one package at a given quantity. Identified by `packageId` (the campaign package `ref_id`). Distinct from a product — one product may appear in multiple packages.

---

## Package ID (`ref_id`)

The numeric identifier for a campaign package as returned by the campaign API. Used as the stable reference for cart operations. Set on elements via `data-package-id`.

---

## Processing state

A transient state during which the cart API call is in flight. Indicated by the `processing` CSS class on the bound element. Prevents double-submission.

---

## Removal feedback

A brief visual signal (300 ms) applied after a successful removal. Adds `item-removed` to the button and `removing` to the nearest cart item ancestor. Intended to trigger CSS exit animations.

---

## Template token

A `{quantity}` placeholder inside the button's `innerHTML`. Replaced with the live cart quantity on every cart store update. Allows button labels like "Remove (2)" without extra JavaScript.
