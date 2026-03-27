# Errors

## `Already processing`

| | |
|---|---|
| Type | Recoverable |
| Cause | The button was clicked while a previous cart write was still in progress. `BaseActionEnhancer` rejects the second call immediately. |

**Fix:**

No action needed. The button is disabled during processing so this only occurs if the click handler is invoked programmatically while `isProcessing` is true. The first action will complete normally.

---

## Cart API errors (from `cartStore.addItem`)

| | |
|---|---|
| Type | Recoverable |
| Cause | The cart API returned an error — invalid package ID, network failure, or session expiry. |

**Fix:**

The error is logged via `this.logger.error` and re-thrown, which causes `BaseActionEnhancer` to emit `action:failed`. The button is re-enabled after the failure.

Check the network tab for the failing API request. Common causes:

- Package ID does not exist in the campaign — verify `data-next-package-id` or the selector's package IDs match campaign data.
- Session expired — the cart store will surface this as an API 401/403.

```ts
// Verify the package exists in campaign data
const campaign = useCampaignStore.getState().data;
const pkg = campaign?.packages.find(p => p.ref_id === packageId);
if (!pkg) console.warn('Package not in campaign:', packageId);
```

---

## `ProfileManager.applyProfile` errors

| | |
|---|---|
| Type | Recoverable |
| Cause | `data-next-profile` is set to a key that does not exist or `ProfileManager` fails to apply it. |

**Fix:**

The error surfaces through `executeAction` and emits `action:failed`. The cart write does not happen if `applyProfile` throws.

Verify the profile key matches one of the configured profiles in the campaign. Check `ProfileManager` logs for details.
