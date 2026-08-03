---
title: "Features/Cart/Package Toggle/Logs"
group: "Features"
category: "Package Toggle"
---

# Logs

> This enhancer logs under the prefix: `PackageToggleEnhancer`

## Healthy output

When running correctly you should see:

```
[PackageToggleEnhancer] debug  Registered toggle card for packageId 101 { isSyncMode: false, syncPackageIds: [], isUpsell: false, quantity: 1 }
[PackageToggleEnhancer] debug  Registered toggle card for packageId 102 { isSyncMode: false, syncPackageIds: [], isUpsell: false, quantity: 1 }
[PackageToggleEnhancer] debug  PackageToggleEnhancer initialized { cardCount: 2, isUpsellContext: false }
```

If a card is pre-selected and auto-add fires, the cart action is logged by `cartStore`, not the enhancer itself.

---

## Info

### `Adding upsell to order from toggle:`

**When:** A card click in upsell context triggers `orderStore.addUpsell()`.

**Meaning:** Expected behavior. Confirms the upsell payload before the API call.

---

## Warn

### `data-next-packages must be a JSON array, ignoring auto-render`

**When:** `data-next-packages` is present and parseable JSON, but the parsed value is not an array.

**Meaning:** Auto-render is skipped. The container's `innerHTML` is not replaced.

**Action:** Correct the attribute value to be a JSON array (e.g., `[{...}]`).

---

### `Invalid JSON in data-next-packages, ignoring auto-render`

**When:** `data-next-packages` contains a string that cannot be parsed as JSON.

**Meaning:** Auto-render is skipped. The container's `innerHTML` is not replaced.

**Action:** Validate the JSON string. Check for unescaped quotes, trailing commas, or other syntax errors.

---

### `Invalid data-next-package-id on toggle card`

**When:** A card element has `data-next-package-id` set to a value that parses as `NaN` (e.g., `"abc"`).

**Meaning:** The card is not registered. It will not respond to clicks and will not reflect cart state.

**Action:** Set `data-next-package-id` to a valid integer matching a package `ref_id`.

---

### `Toggle card is missing data-next-package-id`

**When:** A `[data-next-toggle-card]` element has no `data-next-package-id` attribute and no resolvable `data-package-id` on itself or an ancestor container.

**Meaning:** The card is not registered.

**Action:** Add `data-next-package-id="{packageId}"` to the card element.

---

### `Toggle template produced no root element for packageId`

**When:** The rendered template HTML produces no `[data-next-toggle-card]` child and no first child element.

**Meaning:** That entry in `data-next-packages` is skipped. No card is added to the DOM for that package.

**Action:** Ensure the template HTML produces at least one element. The outermost element is used as the card if no `[data-next-toggle-card]` is found.

---

### `Failed to fetch toggle price for packageId {id}`

**When:** The `calculateBundlePrice` API call throws an error.

**Meaning:** Price slots for that card will fall back to campaign store values (or remain empty). Expected behavior on network error.

**Action:** Check network connectivity and API availability. The next cart change or currency change will trigger a retry.

---

### `Sync card skipped — no synced packages in cart`

**When:** A user clicks a sync-mode card but none of the packages listed in `data-next-package-sync` are currently in the cart.

**Meaning:** The add is intentionally blocked. The sync card cannot be added without at least one synced package present in the cart.

**Action:** No action required. The synced packages must be added to the cart first. The sync card will become clickable once a synced package is present.

---

### `Order does not support upsells at this time`

**When:** A card click fires in upsell context and `orderStore.canAddUpsells()` returns false.

**Meaning:** The upsell window has closed. If `data-next-url` is configured, the enhancer navigates there instead.

**Action:** No action required unless this appears unexpectedly before the upsell window closes.

---

### `Invalid navigation URL:`

**When:** The `data-next-url` value cannot be parsed as a URL by the `URL` constructor.

**Meaning:** The enhancer falls back to `window.location.href = preserveQueryParams(url)` using the raw string.

**Action:** Verify `data-next-url` is a valid absolute or relative URL.

---

## Debug

### `Registered toggle card for packageId {id}`

**When:** A card element is successfully registered (on init or via mutation observer).

**Meaning:** Expected. Confirms the card is active and will respond to clicks.

---

### `PackageToggleEnhancer initialized`

**When:** `initialize()` completes.

**Meaning:** Expected. The `cardCount` field shows how many cards are registered. If `cardCount` is 0, check that `[data-next-toggle-card]` elements are present or that auto-render attributes are correct.

---

### `Skipping pre-selected sync card — no synced packages in cart`

**When:** A sync-mode card has `data-next-selected="true"` but none of the synced packages are in the cart yet during a `syncWithCart` cycle.

**Meaning:** Expected. The auto-add is deferred. The card retains its pre-selected state and will auto-add on the next cart update once a synced package appears.

---

## Warn

### `No campaign package found for packageId`

**When:** A toggle card names a `data-next-package-id` that is not in the campaign.

**Meaning:** The card renders with no price and toggling it will fail. Most often a card was copied between campaigns, where the same product has a different `ref_id`.

**Action:** Look the id up in the campaign's package list. Ids are per-campaign, so they cannot be shared across landing pages for different campaigns.

---

### `Unknown toggle display property: "{property}"`

**When:** A `data-next-toggle-display` slot names a field the package does not expose.

**Meaning:** The element keeps its authored placeholder text, so the card shows a stale or literal value rather than a price.

**Action:** Check the spelling against the display-field list in [attributes.md](./attributes.md).

---

## Error

### `handleCardClick failed`

**When:** A click on a toggle card threw before the cart write completed.

**Meaning:** The card's visual state and the cart may now disagree — the class says in-cart while the cart says otherwise, or the reverse.

**Action:** Read the logged error object; it carries the underlying cause. The card recovers on the next cart update, so a visitor clicking again usually resolves it, but a repeatable failure means the package or the campaign data is wrong.

---

### `handleUpsellCardClick failed: {error}`

**When:** The same, on a card in upsell mode (`data-next-upsell-context`), where the click adds to the existing order rather than the cart.

**Meaning:** The add did not complete. Order writes are not reversible from the page, so check the order before offering a retry.

**Action:** Read the order in the network tab and confirm whether the line landed before letting the visitor click again — a blind retry can add it twice.
