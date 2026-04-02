# Logs

> This enhancer logs under the prefix: `BundleSelectorEnhancer`

## Healthy output

When running correctly with two cards, you should see:

```
[BundleSelectorEnhancer] Registered bundle card "starter" { itemCount: 1 }
[BundleSelectorEnhancer] Registered bundle card "value" { itemCount: 1 }
[BundleSelectorEnhancer] BundleSelectorEnhancer initialized { mode: "swap", cardCount: 2 }
[BundleSelectorEnhancer] Applied bundle "starter" (selector "upsellBundleMV") [{ packageId: 101, quantity: 1, selectorId: "upsellBundleMV" }]
```

Price fetches run asynchronously after init. No additional logs appear for a successful price load.

---

## Debug

### `Registered bundle card "{bundleId}" { itemCount: N }`

**When:** A card element with `[data-next-bundle-card]` is successfully registered with valid `data-next-bundle-id` and `data-next-bundle-items`.

**Meaning:** Expected behavior. Fires once per card on init, and again for any cards added to the DOM after init via the mutation observer.

---

### `BundleSelectorEnhancer initialized { mode, cardCount }`

**When:** The enhancer finishes `initialize()`.

**Meaning:** Expected behavior. Confirms the selector is running, its mode, and how many cards were registered.

---

### `Applied bundle "{bundleId}" [...]`

**When:** A bundle's items are successfully written to the cart via `swapCart`.

**Meaning:** Expected behavior. The cart now contains the new bundle's items.

---

### `Variant change synced for bundle "{bundleId}" [...]`

**When:** A variant selection change on the currently selected bundle is successfully written to the cart.

**Meaning:** Expected behavior. The cart is updated to reflect the new variant choice.

---

### `Variant changed on bundle "{bundleId}" slot {index} { packageId }`

**When:** A variant selection resolves to a different package and `slot.activePackageId` is updated.

**Meaning:** Expected behavior. Confirms which package the slot now points to after the variant change.

---

## Warn

### `data-next-bundles must be a JSON array, ignoring auto-render`

**When:** `data-next-bundles` is present with valid JSON but the value is not an array (e.g., an object or a string).

**Meaning:** Auto-render is disabled. No cards are generated. The container is empty until cards are added manually.

**Action:** Fix `data-next-bundles` to be a JSON array: `[{"id":"starter","items":[...]}]`.

---

### `Invalid JSON in data-next-bundles, ignoring auto-render <value>`

**When:** `data-next-bundles` contains a string that cannot be parsed as JSON.

**Meaning:** Auto-render is disabled. Syntax error in the attribute value.

**Action:** Validate the JSON. Common issues: unquoted keys, trailing commas, single quotes instead of double quotes.

---

### `Bundle card is missing data-next-bundle-id`

**When:** An element with `[data-next-bundle-card]` has no `data-next-bundle-id` attribute.

**Meaning:** The card is skipped and will not be selectable.

**Action:** Add `data-next-bundle-id="<unique-id>"` to the card element.

---

### `Bundle card "{bundleId}" is missing data-next-bundle-items`

**When:** A card with a valid `data-next-bundle-id` has no `data-next-bundle-items` attribute.

**Meaning:** The card is skipped. No items can be added to the cart for this bundle.

**Action:** Add `data-next-bundle-items='[{"packageId":101,"quantity":1}]'` to the card.

---

### `Invalid JSON in data-next-bundle-items for bundle "{bundleId}"`

**When:** `data-next-bundle-items` is present but cannot be parsed as JSON.

**Meaning:** The card is skipped.

**Action:** Validate the JSON in `data-next-bundle-items`.

---

### `Bundle "{bundleId}" has no items`

**When:** `data-next-bundle-items` parses to an empty array.

**Meaning:** The card is skipped. Nothing would be added to the cart.

**Action:** Add at least one item to the array.

---

### `No package found for variant combination <selectedAttrs>`

**When:** The visitor selects a variant combination for which no matching package exists in the campaign store.

**Meaning:** The variant change is ignored. The slot retains its previous `activePackageId`. The cart is not updated.

**Action:** Confirm all valid variant combinations have corresponding packages in the campaign data. If a combination is intentionally unavailable, mark the option's package `product_purchase_availability` as `'unavailable'` in the backend so the UI reflects it correctly.

---

### `Invalid JSON in data-next-bundle-vouchers <value>`

**When:** `data-next-bundle-vouchers` starts with `[` but cannot be parsed as a JSON array.

**Meaning:** No vouchers are loaded for this card. Voucher apply/remove logic is skipped.

**Action:** Fix the JSON or use a comma-separated string format: `"CODE1,CODE2"`.

---

### `Variant selector template produced no root element for attribute <code>`

**When:** `data-next-variant-selector-template-id` is set but the rendered template HTML has no root element for the given attribute code.

**Meaning:** The variant selector group for that attribute is not rendered. The visitor cannot select variants for that attribute.

**Action:** Ensure the variant selector template produces a single root element.

---

### `Failed to fetch bundle price for "{bundleId}" <error>`

**When:** The price API call for a bundle card throws or returns an error.

**Meaning:** Price elements for that card retain their previous value (or remain at their initial content on first load). The card is still selectable and the cart still works.

**Action:** Check network requests in the browser DevTools. Verify all `packageId` values in the bundle are valid and the API is reachable.

---

## Error

### `Error in applyBundle: <message>`

**When:** `swapCart` throws during a bundle apply operation.

**Meaning:** The cart was not updated. The enhancer reverts visual selection to the previous card (or clears selection if this was the first selection). The page is in a recoverable state.

**Action:** Check network requests. Common causes: API timeout, invalid package ID, or server error. If the problem persists, check that all `packageId` values in the bundle exist in the backend.

---

### `Error in applyEffectiveChange: <message>`

**When:** `swapCart` throws when syncing the cart after a variant change on the selected bundle.

**Meaning:** The cart was not updated to reflect the variant change. The slot UI has already re-rendered to show the new variant, but the cart still contains the old items. The state is temporarily inconsistent until the next cart sync.

**Action:** Check network requests. Same root causes as `Error in applyBundle`.
