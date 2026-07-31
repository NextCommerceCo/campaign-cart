---
title: "Features/Order/Upsell/Logs"
group: "Features"
category: "Upsell"
---

# Logs

> This enhancer logs under the prefix: `[UpsellEnhancer]`. The order store logs under `[OrderStore]`.

## Healthy output

A successful add looks like:

```
[UpsellEnhancer] UpsellEnhancer initialized { mode: 'direct', packageId: 123, quantity: 1, ... }
[UpsellEnhancer] Upsell action clicked: { action: 'add', nextUrl: '/receipt/' }
[UpsellEnhancer] Adding upsell to order: { lines: [...], currency: 'USD' }
[UpsellEnhancer] Upsell added successfully
[UpsellEnhancer] Navigating to /receipt/?ref_id=...
```

---

## Info

### `Adding upsell to order: {payload}`

**When:** An add passed validation and the API call is being made.

**Meaning:** Expected. Shows the exact lines and currency submitted.

### `Upsell added successfully`

**When:** The API returned an updated order.

**Meaning:** Expected — the line was added.

### `Navigating to {url}`

**When:** Redirecting after an add or skip.

**Meaning:** Expected.

### `Upsell skipped by user`

**When:** A skip/decline button was clicked.

**Meaning:** Expected.

---

## Warn

### `No package selected for upsell`

**When:** An add fired in selector mode with nothing chosen and no bundle items.

**Meaning:** The customer must pick an option first. **Action:** Pre-select a default or prompt for a choice; not a system fault.

### `Order does not support upsells or is currently processing`

**When:** `canAddUpsells()` was false at click time.

**Meaning:** Either the order lacks `supports_post_purchase_upsells`, or an add is already in flight. **Action:** Confirm the order supports upsells; if the processing flag is stuck it is reset once automatically.

### `Unknown upsell action: {action}`

**When:** A `data-next-upsell-action` value other than add/accept/skip/decline was clicked.

**Meaning:** Markup typo. **Action:** Fix the attribute value.

---

## Debug

### `UpsellEnhancer initialized {details}`

**When:** Initialization completes.

**Meaning:** Shows the resolved mode, package/selector ids, quantity, and counts.

### `Upsell action clicked: {action, nextUrl}`

**When:** Any action button is clicked.

### `Upsell option selected: {packageId, selectorId}`

**When:** A selector option is chosen.

### `Using fallback URL from meta tag: {url}`

**When:** No URL attribute was on the button, so a `next-upsell-*-url` meta tag was used.

### `Tracked upsell page view: {pagePath}`

**When:** A page view was recorded (page-type meta present, first time for this path).

---

## Warn (continued)

### `No URL provided for navigation`

**When:** An action button completed its work but had no `data-next-url` and no matching `next-upsell-*-url` meta tag to fall back on.

**Meaning:** The visitor stays on the upsell page after accepting or declining. The order was still updated — only the navigation is missing, which reads to the visitor as a button that did nothing.

**Action:** Set `data-next-url` on the button, or add the `<meta name="next-upsell-accept-url">` / `next-upsell-decline-url` tags so every upsell page has a default next step.

---

### `Processing flag stuck, resetting...`

**When:** A new click arrives while the previous one is still marked in-flight, long enough that the guard is assumed stale.

**Meaning:** A prior action never finished — usually a rejected request whose handler did not clear the flag. The click is allowed through.

**Action:** Look for the earlier error in the console; this line is the symptom, not the cause. Seen repeatedly, it means an action is failing without reporting.

---

## Error

### `Failed to add upsell: {error}`

**When:** `orderStore.addUpsell()` throws.

**Meaning:** The upsell is not on the order. The logged object carries the API response.

**Action:** Check the response body. Common causes: the order no longer accepts upsells server-side, the package id is not in the campaign, or the session expired.

### `Invalid URL for navigation: {url}`

**When:** A resolved next-URL cannot be parsed.

**Meaning:** Navigation is skipped and the visitor stays put, even though the order was updated.

**Action:** Give the attribute an absolute URL, or a root-relative path (`/upsell-2`). A bare `upsell-2` with no leading slash is the usual cause.

### `Upsell error: {error}`

**When:** Rendering the offer failed — the package could not be resolved, or a template produced nothing.

**Meaning:** The offer does not appear. The visitor sees an empty section and moves on, so this costs revenue silently.

**Action:** Confirm the `data-next-package-id` is in the campaign and that any custom template's first node is an element.
