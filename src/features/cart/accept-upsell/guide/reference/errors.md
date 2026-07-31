---
title: "Features/Cart/Accept Upsell/Errors"
group: "Features"
category: "Accept Upsell"
---

# Errors

## `Failed to add upsell — no order returned`

| | |
|---|---|
| Type | Fatal |
| Cause | `orderStore.addUpsell()` resolved but returned `null`. This happens when the store's internal guard blocked the call (e.g., `isProcessingUpsell` was already true, or `refId` was missing). |

**Fix:**

Confirm that `orderStore.refId` is set before the button is clicked. If you are calling `triggerAcceptUpsell()` programmatically, ensure you wait for the SDK to finish loading the order first.

Check the console for warnings from `orderStore` — it logs when it blocks an `addUpsell` call:
- `No order reference ID available` — the `ref_id` was never set. Confirm the page URL has a `?ref_id=` parameter.
- `Upsell processing already in progress` — a previous click is still in flight. Wait for it to complete before triggering again.

---

## `Already processing` (from BaseActionEnhancer)

| | |
|---|---|
| Type | Recoverable |
| Cause | The user clicked the button a second time before the first click's API call completed. `executeAction()` rejects the second call immediately. |

**Fix:**

No action needed. The button is disabled by `disableOnProcess: true` during processing so this should not be reachable in normal use. If it occurs, check that the button's `disabled` attribute is not being removed by another script.

---

## `Failed to add bundle upsell — no order returned`

| | |
|---|---|
| Type | Recoverable |
| Cause | A bundle upsell was accepted and the API returned success, but no updated order came back with it. |

**Fix:**

Check the order in the network tab **before** offering a retry. A bundle sends several lines, so the order may hold part of the bundle even though the page saw no order back — accepting again would duplicate whatever landed.

If the order is unchanged, the visitor can retry safely. If it reproduces on every attempt, the order no longer accepts upsells server-side and the offer should be hidden rather than retried.
