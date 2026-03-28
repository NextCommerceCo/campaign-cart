# Events

The campaign store does not emit its own events directly. It triggers one platform event via `EventBus` during `loadCampaign`.

## `currency:fallback`

**When:** The campaign API (or cache) returns a currency different from the one that was requested. This can happen when the requested currency is not available for the campaign.

**Payload:**

| Field | Type | Description |
|-------|------|-------------|
| `requested` | `string` | The ISO 4217 currency code that was requested (e.g. `EUR`) |
| `actual` | `string` | The ISO 4217 currency code that was actually served (e.g. `USD`) |
| `reason` | `'api' \| 'cached'` | Whether the fallback came from the API response or from a cached entry for a different currency |

**Example:**
```json
{
  "requested": "EUR",
  "actual": "USD",
  "reason": "api"
}
```
