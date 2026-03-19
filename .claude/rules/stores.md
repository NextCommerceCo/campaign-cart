# Zustand Store Rules

## Available Stores
| Store | File | Purpose |
|-------|------|---------|
| `useCartStore` | `src/stores/cartStore.ts` | Cart items, totals, coupons, shipping |
| `useCampaignStore` | `src/stores/campaignStore.ts` | Campaign/package data (10-min cache) |
| `useOrderStore` | `src/stores/orderStore.ts` | Post-purchase order/upsell (15-min expiry) |
| `useCheckoutStore` | `src/stores/checkoutStore.ts` | Checkout form state & validation |
| `useConfigStore` | `src/stores/configStore.ts` | SDK configuration |
| `useAttributionStore` | `src/stores/attributionStore.ts` | UTM & referral tracking |
| `useProfileStore` | `src/stores/profileStore.ts` | Profile mapping & selection |
| `useParameterStore` | `src/stores/parameterStore.ts` | URL parameters |

## Critical: campaignStore Field Name
The campaign data field is **`.data`**, not `.campaign`:
```ts
// CORRECT
const campaign = useCampaignStore.getState().data;

// WRONG — will be undefined
const campaign = useCampaignStore.getState().campaign;
```

## Access Patterns
```ts
// One-time read (outside React/enhancer subscription)
const items = useCartStore.getState().items;

// Reactive subscription in enhancers — use this.subscribe()
this.subscribe(useCartStore, state => {
  this.renderItems(state.items);
});

// Mutation — call store actions
useCartStore.getState().addItem(item);
useCartStore.getState().removeItem(itemId);
```

## Adding State to a Store
- Keep stores focused; don't add unrelated state to an existing store
- Add actions alongside state — stores own their mutation logic
- `cartStore` and `campaignStore` use `persist` middleware (sessionStorage); new fields persist automatically
- `orderStore` has a 15-minute expiry; new fields should respect that TTL
- After adding fields, update the relevant type in `src/types/` if it's a shared shape

## Don't
- Don't import stores into `src/types/` or `src/api/` — causes circular deps
- Don't mutate state objects directly — always use store actions
- Don't create new stores without a clear reason; check if existing stores can hold the state
