---
title: "Features/Order/Upsell/Errors"
group: "Features"
category: "Upsell"
---

# Errors

## `UpsellEnhancer requires data-next-package-id (or selector mode with data-next-selector-id)`

| | |
|---|---|
| Type | Fatal |
| Cause | The element has neither `data-next-package-id` (direct mode) nor a selector (`data-next-selector-id` / a package/bundle selector). |

**Fix:** Add a package id or set up selector mode.

```html
<div data-next-upsell="offer" data-next-package-id="123"> … </div>
```

---

## `Invalid package ID provided`

| | |
|---|---|
| Type | Fatal |
| Cause | `data-next-package-id` is present but not a number. |

**Fix:** Use a numeric campaign package id, e.g. `data-next-package-id="123"`.

---

## `Unable to add upsell at this time` (rendered)

| | |
|---|---|
| Type | Recoverable |
| Cause | `canAddUpsells()` is false — the order does not support post-purchase upsells, or an add is already processing, or the order session has expired (15-minute TTL). |

**Fix:** Confirm the order was created with `supports_post_purchase_upsells` and that the page is reached within the order's 15-minute window. The `next-error` class is removed after 5 seconds; if a next URL is set the customer is still forwarded after ~1s.

---

## `Please select an option first` (rendered)

| | |
|---|---|
| Type | Recoverable |
| Cause | An add fired in selector mode with no option selected and no bundle items. |

**Fix:** Have the customer choose an option, or pre-select one with `data-next-selected="true"`.

---

## `Failed to add upsell` / API error message (rendered)

| | |
|---|---|
| Type | Recoverable |
| Cause | The `addUpsell` API call threw, or returned no updated order. |

**Fix:** Check the network request and the order's eligibility. The offer shows `next-error` (cleared after 5s) and emits `upsell:error`; if a next URL is set the customer is still forwarded so the funnel continues.

---

## `Failed to add upsell - no updated order returned`

| | |
|---|---|
| Type | Recoverable |
| Cause | `addUpsell` succeeded but returned no updated order, so the page cannot show what the order now contains. |

**Fix:**

Read the order in the network tab before letting the visitor click again — the line may already be on it, and a second click would add it twice.

The offer shows `next-error` and emits `upsell:error`, and if a next URL is set the visitor is still forwarded so the funnel continues. That means this can pass unnoticed in production: watch for `upsell:error` in analytics rather than relying on someone reporting it.
