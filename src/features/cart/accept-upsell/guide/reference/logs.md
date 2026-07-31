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

**Meaning:** Expected on a correctly built page, and not by itself a fault. The lookup only matches a container carrying `data-next-upsell-selector`, `data-next-upsell-select`, or `data-next-upsell`, so the recommended `data-next-package-selector` setup always logs it — verified against `accept-upsell.enhancer.ts:125`. The button still works from the visitor's first card click, which arrives as `selector:item-selected`. What it loses is the selector's own start-up pre-selection: the button may or may not have heard that, so it can boot enabled or disabled on the same markup. See [overview.md](../overview.md) Limitations.

**Action:** Ignore it unless the accept button never enables. If it does not, check that the two `data-next-selector-id` values match exactly, and click a card — if that enables it, you are looking at the pre-selection gap above rather than a wiring mistake.

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
