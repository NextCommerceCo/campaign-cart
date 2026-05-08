# Get Started

## Prerequisites

- SDK initialized via `NextCommerce.init({ apiKey: '...' })`
- `SDKInitializer` enhancer present in the page (calls `loadCampaign` automatically)

## Setup

The store is loaded automatically by `SDKInitializer`. You do not call `loadCampaign` manually in normal usage.

1. Add `data-next-sdk` to your page's init element (handled by `SDKInitializer`).
2. Access campaign data anywhere in the SDK after initialization:

```ts
import { useCampaignStore } from '@/stores/campaignStore';

// One-time read
const campaign = useCampaignStore.getState().data;
const pkg = useCampaignStore.getState().getPackage(42);

// Reactive subscription inside an enhancer
this.subscribe(useCampaignStore, state => {
  this.render(state.packages);
});
```

3. To force a fresh fetch (e.g. after the user switches currency):

```ts
await useCampaignStore.getState().loadCampaign(apiKey, { forceFresh: true });
```

## Verify it is working

After initialization you should see:

- Console: `[CampaignStore] Fetching campaign data from API with currency: USD...`
- Console: `[CampaignStore] Campaign data cached for USD (10 minutes)`
- `useCampaignStore.getState().data` returns a non-null `Campaign` object
- `useCampaignStore.getState().packages` is a non-empty array of `Package` objects

On subsequent loads (within 10 minutes):

- Console: `[CampaignStore] Using cached campaign data for USD (expires in NNN seconds)`

## Next steps

- Query methods: [reference/object-attributes.md](./reference/object-attributes.md)
- Currency fallback behavior: [overview.md](./overview.md#business-logic)
- Log reference: [reference/logs.md](./reference/logs.md)
