# Logs

> This enhancer logs under the prefix: `PackageSelectorEnhancer`

## Healthy output

When running correctly with two cards, you should see:

```
[PackageSelectorEnhancer] Registered selector card for package 101
[PackageSelectorEnhancer] Registered selector card for package 102
[PackageSelectorEnhancer] Initialized { selectorId: "main-selector", mode: "swap", isUpsellContext: false, itemCount: 2 }
```

Prices fetch asynchronously after init, so there are no additional logs for successful price loads.

---

## Debug

### `Registered selector card for package <packageId>`

**When:** A card element (`[data-next-selector-card]`) is successfully registered with a valid `data-next-package-id`.

**Meaning:** Expected behavior. Fires once per card on init, and again for any cards added to the DOM after init via mutation observer.

---

### `Initialized { selectorId, mode, isUpsellContext, itemCount }`

**When:** The enhancer finishes `initialize()`.

**Meaning:** Expected behavior. Confirms the selector is running, its mode, and how many cards were registered.

---

## Warn

### `data-next-packages must be a JSON array, ignoring auto-render`

**When:** `data-next-packages` is present but its value is valid JSON that is not an array (e.g., an object or a string).

**Meaning:** Auto-render is disabled. No cards are generated. The container is empty until cards are added manually.

**Action:** Fix the `data-next-packages` value to be a JSON array: `[{"packageId":101},...]`.

---

### `Invalid JSON in data-next-packages, ignoring auto-render <value>`

**When:** `data-next-packages` contains a string that cannot be parsed as JSON.

**Meaning:** Auto-render is disabled. Syntax error in the attribute value.

**Action:** Validate the JSON. Common issues: unquoted keys, trailing commas, single quotes instead of double quotes.

---

### `Selector card is missing data-next-package-id`

**When:** An element with `[data-next-selector-card]` is found but has no `data-next-package-id` attribute.

**Meaning:** The card is skipped. It will not be selectable or registered.

**Action:** Add `data-next-package-id="<id>"` to the card element.

---

### `Invalid data-next-package-id on selector card <value>`

**When:** `data-next-package-id` is present but its value cannot be parsed as an integer.

**Meaning:** The card is skipped. It will not be selectable or registered.

**Action:** Set `data-next-package-id` to a valid integer matching the package `ref_id`.

---

### `Invalid shipping ID: <value>`

**When:** `data-next-shipping-id` on a card is present but parses to `NaN`.

**Meaning:** No shipping method is set when this card is selected. Everything else (selection, cart add) works normally.

**Action:** Set `data-next-shipping-id` to a valid integer shipping method ID, or remove the attribute if no shipping override is needed.

---

### `Failed to fetch price for package <packageId>`

**When:** The bundle price API call for a card throws or returns an error.

**Meaning:** Price slots for that card retain their previous value (or remain blank on first load). The card is still selectable and the cart still works.

**Action:** Check network requests for the bundle price API call. Verify the `packageId` is valid and the API is reachable.
