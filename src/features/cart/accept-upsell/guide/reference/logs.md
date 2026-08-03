---
title: "Features/Cart/Accept Upsell/Logs"
group: "Features"
category: "Accept Upsell"
---

# Logs

> This enhancer logs under the prefix: `[AcceptUpsellEnhancer]`

## Healthy output

When running correctly on a page with a valid order you should see:

```
[AcceptUpsellEnhancer] Initialized { packageId: 42, selectorId: undefined, quantity: 1 }
```

On click (with redirect):
```
[AcceptUpsellEnhancer] Using fallback URL from <meta name="next-upsell-accept-url">: /upsell-2
```

---

## Debug

### `Initialized { packageId, selectorId, quantity }`

**When:** `initialize()` completes.

**Meaning:** Expected. Confirms the enhancer read its attributes and set up its subscriptions. `selectorId` is `undefined` when using a direct package ID.

### `Using fallback URL from <meta name="next-upsell-accept-url">: {url}`

**When:** `data-next-url` is not set but a `<meta name="next-upsell-accept-url">` tag is present.

**Meaning:** Expected. The redirect URL came from the meta tag, not the attribute.

### `Using fallback URL from <meta name="next-upsell-decline-url">: {url}`

**When:** The duplicate dialog was cancelled, `data-next-url` is not set, and a `<meta name="next-upsell-decline-url">` tag is present.

**Meaning:** Expected. The decline redirect URL came from the meta tag.

---

## Info

### `User confirmed to add duplicate upsell`

**When:** The duplicate confirmation dialog was shown and the user clicked "Yes, Add Again".

**Meaning:** Expected. The upsell will be submitted a second time.

### `User declined to add duplicate upsell`

**When:** The duplicate confirmation dialog was shown and the user clicked "Skip to Next".

**Meaning:** Expected. The upsell is not submitted again. The user is navigated to the decline URL if one is configured.

---

## Warn

### `Selector "{selectorId}" not found`

**When:** `data-next-selector-id` is set but the 100 ms initialization read matched no element.

**Meaning:** A real fault, not routine noise. The lookup matches every supported container — `data-next-package-selector`, `data-next-upsell-selector`, `data-next-upsell-select` and `data-next-upsell` — so on a correctly built page it finds one and this does not fire. Two things still produce it: the two `data-next-selector-id` values do not match exactly, or the selector container reaches the DOM later than 100 ms after the button (rendered into a tab or modal, or behind a deferred script). In the second case the button recovers on the visitor's first card click, which arrives as `selector:item-selected`.

**Action:** Check that the two `data-next-selector-id` values match exactly. If they do, the container is rendering late — move the button inside the same container so both are scanned together, and expect the button to start disabled until the first card click.

### `No package ID available for accept-upsell action`

**When:** The button was clicked but neither `data-next-package-id` nor a selector selection resolved to a package ID.

**Meaning:** No package to submit. The click is silently ignored. This can happen if the selector has not yet received a selection event.

**Action:** Set `data-next-package-id` on the button, or make sure the visitor cannot reach it before they have clicked a card. Do not count on the selector's pre-selection to fill this in — the button does not always hear it ([overview.md](../overview.md) Limitations).

---

## Error

### `No order loaded`

**When:** The button was clicked but `orderStore.order` is null.

**Meaning:** The order has not loaded yet or has been cleared. The click is silently ignored.

**Action:** Confirm the page URL contains a valid `?ref_id=` parameter and that `orderStore.loadOrder()` has been called by the SDK initializer.

### `Failed to accept upsell: {error}`

**When:** `orderStore.addUpsell()` throws.

**Meaning:** The API call failed. The loading overlay is dismissed immediately. The error is rethrown and the `action:failed` event is emitted.

**Action:** Check the network tab for the API response. Common causes: the order no longer supports upsells server-side, the package ID is invalid, or the session has expired.

---

### `Failed to accept bundle upsell: {error}`

**When:** The accepted upsell is a bundle (several packages accepted as one) and `orderStore.addUpsell()` throws part-way through.

**Meaning:** The bundle is not added. Unlike a single-package add, a bundle sends several lines, so it is worth checking whether the order now holds a partial bundle before retrying.

**Action:** Read the order in the network tab and compare its lines against the bundle's `data-next-bundle-items`. If some lines landed, remove them before retrying rather than accepting again.

---

## Warn

### `Bundle selector "{bundleSelectorId}" not found`

**When:** `data-next-bundle-selector-id` is set on the accept button but no `[data-next-bundle-selector]` with that id exists on the page.

**Meaning:** The button cannot resolve what to accept, so a click does nothing.

**Action:** Check the id matches exactly on both elements. If the selector is rendered later — inside a tab or a modal — the button initialises first and this fires; move the button inside the same container so both are scanned together.

---

### `No bundle items selected for upsell`

**When:** The button resolved its bundle selector, but no bundle is currently selected.

**Meaning:** Nothing is added. This is reachable by a visitor if the selector has no pre-selected bundle and the button is clickable before they choose one.

**Action:** Either mark one bundle `data-next-selected="true"` so there is always a selection, or hide the button until one exists with `data-next-show="…"`.
