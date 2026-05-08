# Errors

## `Campaign data not found`

| | |
|---|---|
| Type | Fatal |
| Cause | `ApiClient.getCampaigns()` returned `null` or `undefined`. This should not happen under normal API conditions but can occur if the API key has no associated campaign. |

**Fix:**

Verify the API key is correct and that the campaign exists in the 29Next dashboard.

```ts
// Check which key is being used
const { useConfigStore } = await import('@/stores/configStore');
console.log(useConfigStore.getState().apiKey);
```

---

## `Failed to load campaign`

| | |
|---|---|
| Type | Fatal |
| Cause | Generic catch-all for any error thrown inside `loadCampaign` that is not the "Campaign data not found" error — typically a network failure or a JSON parsing error from the API response. |

**Fix:**

Check the browser network tab for the `/api/v1/campaigns/` request. Common causes:
- Network is offline
- API key is invalid (returns a 401 or 403)
- API returned a non-JSON response

The full error is logged via `[CampaignStore] Campaign load failed:` — check that log entry for the original error message.
