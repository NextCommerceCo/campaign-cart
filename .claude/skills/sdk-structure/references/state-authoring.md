# State Authoring (writing a store)

Today stores live in `stores/`; target is `state/`. Default is **one file per
store** (`<domain>.state.ts`); split into a folder only when it grows (below).
Access and persistence invariants are in
[behavior-contracts.md](behavior-contracts.md).

---

## What a store is (and is NOT)

A store is a **state container**: state fields + **sync setters** that write
them. It is NOT a logic hub.

- **In the store:** state + small synchronous mutations (`setItems`,
  `setShipping`, `reset`).
- **NOT in the store:** async orchestration, API calls, multi-step business
  flows (add-to-cart → fetch → recalc → emit). That logic lives in the
  **feature** that owns the behavior (a `features/<cat>/<feature>/` handler or a
  shared feature service). It reads/writes the store through its setters and
  calls the api layer directly. The SDK is event-driven — cross-feature
  coordination goes through the EventBus, not a fat store.

This keeps `state/` thin and makes the same operations reusable without the DOM
layer. **Reference implementation:** the cart's async logic lives in
`state/cart/operations/` (command files: `add-item.ts`, `swap-cart.ts`,
`calculate-totals.ts`, …), exported as `cartOperations` and surfaced as
`sdk.cart.*`. The `cart.state.ts` store is thin (state + sync setters) and simply
spreads `cartOperations` for backward compatibility. New async cart behavior goes
in an operation file, not the store. Operations sit in the **state layer** (not a
feature) because they're shared by many callers — core, multiple features,
debug, and cross-store — which the dependency rules only permit from `state/`.

---

## The stores

| Store | File | Purpose |
|-------|------|---------|
| `useCartStore` | `state/cart/` (+ `operations/`) | Cart items, totals, coupons, shipping. Async logic in `operations/` |
| `useCampaignStore` | `state/campaign/` | Campaign/package data (10-min cache). Field is **`.data`** |
| `useOrderStore` | `state/order/` | Post-purchase order/upsell (15-min expiry) |
| `useCheckoutStore` | `state/checkout/` | Checkout form state & validation |
| `useConfigStore` | `state/config/` | SDK configuration |
| `useAttributionStore` | `state/attribution/` | UTM & referral tracking |
| `useParameterStore` | `state/parameter/` | URL parameters |

---

## Every store is a folder

A store owns a `state/<domain>/` folder — even when the store itself is one
file. The folder is what makes the code and the docs that describe it one unit:

```
state/order/
├── index.ts                    # barrel — re-exports only, NO logic
├── order.state.ts              # the store: create() + middleware + state/actions
├── order.state-manifest.ts     # what the generated state reference is built from
└── guide/                      # overview + reference/state-reference.md
```

Callers import the **folder** (`@/state/order`), never the inner file. Before
2026-07-31 five stores sat flat in `state/` next to a same-named folder that
held only `guide/` — a shadow folder — and the two halves of one store could
drift apart unnoticed. One-line shims (`export * from './order'`) still sit at
those old paths while the last imports are swept; they re-export the barrel, so
both paths resolve to a single store instance.

Inside the folder, **one file for the store is still the default.** Do NOT
pre-split it into items/ui/api slice files, and do NOT put async/business logic
in it (that goes in the feature, see above). `checkout`, `order`, `config`,
`attribution` and `parameter` are one-file stores and should stay that way.

## Split into more files only when it grows

When a single store file gets genuinely hard to read (~300 lines — the same
signal as a feature), split it **by real sub-domain, not a forced items/ui/api
trichotomy**:

```
state/cart/
├── index.ts           # barrel — re-export hook + public types
├── cart.state.ts      # the store: create() + compose + middleware + core state/actions
├── cart.types.ts      # CartState = union of the slice interfaces (only when large)
├── coupon.slice.ts    # a sub-domain slice — ONLY when it earns its own file
└── shipping.slice.ts
```

Slices are named `<sub-domain>.slice.ts` — the sub-domain first, `slice` as the
role suffix (matching `.state.ts` / `.types.ts`). The folder already says
`cart`, so don't repeat it in the filenames.

Today only `cart/` and `campaign/` carry slice files, because they earned them.
Add a slice file only when a group of state + actions has its own reason to
change (its own loading/error cycle, an independently-describable concern) or
the file is past ~300 lines.

### When you do split — one file, one responsibility

| File | Owns | Never contains |
|---|---|---|
| `<domain>.state.ts` | `create()`, compose, middleware, core actions | raw `fetch`, unrelated concerns |
| `<domain>.types.ts` | interfaces, enums, type aliases | logic, default values |
| `<sub>.slice.ts` | one sub-domain's state + actions | another sub-domain's state |
| `index.ts` | re-exports for consumers | implementation details |

The HTTP call itself always lives in the api layer (`core/http` callers), never
inside a store file — see Patterns below.

---

## Patterns

**API layer** — `fetch`/`axios` only, no Zustand; returns typed data or throws:
```ts
export const cartApi = {
  fetchCart: async (): Promise<CartItem[]> => {
    const res = await fetch('/api/cart')
    if (!res.ok) throw new Error('Failed to fetch cart')
    return res.json()
  },
}
```

**Async orchestration lives in the FEATURE, not the store** — a feature handler
imports the api layer + the store, and writes results back via sync setters:
```ts
// features/cart/add-to-cart/add-to-cart.handlers.ts
export async function addToCart(item) {
  const store = useCartStore.getState()
  store.setLoading(true)
  try {
    const items = await cartApi.add(item)   // I/O in the api layer (core/http)
    store.setItems(items)                    // sync setter on the store
  } finally {
    store.setLoading(false)
  }
}
```

**Sync setter (in the store)** — pure `set()`, prefer functional updates:
```ts
addItem: (item) => set((s) => ({ items: [...s.items, item] })),   // good
addItem: (item) => set({ items: [...get().items, item] }),        // bad — stale read
```

**Store composer** (only when split into slices) — `create()` + spread slices +
middleware only; middleware order `devtools( persist( immer( …slices ) ) )`. A
single-file store calls `create()` with its state/actions inline instead:
```ts
export const useCartStore = create<CartState>()(
  devtools(persist((...a) => ({
    ...createCartItemsSlice(...a),
    ...createCartApiSlice(...a),
    ...createCartUiSlice(...a),
  }), { name: 'cart-storage' }))
)
```

**Types** — when split, `{Feature}State` = union of slice interfaces (no
logic/defaults); a single-file store can define the one state interface inline:
```ts
export interface CartState extends CartItemsSlice, CartApiSlice, CartUiSlice {}
```

**Selectors** — always a selector function; never destructure the whole store:
```ts
const items = useCartStore((s) => s.items)   // good — re-renders only on items change
const { items } = useCartStore()             // bad — re-renders on any change
```

**Public API** — consumers import from `index.ts` only, never internal slices.

---

## Slices are rare

Because async/business logic lives in features, a store is usually just state +
sync setters in one file. Only split into a `<sub>.slice.ts` when the **sync
state itself** has a large, independently-describable sub-domain *and* the file
is past ~300 lines. Never create a store per component — stores are feature-level.

## Adding state

- Keep stores focused; don't add unrelated state to an existing store.
- Add **sync setters** alongside state; keep async/business logic in the feature.
- New fields in `cartStore`/`campaignStore` persist automatically; `orderStore`
  fields must respect the 15-minute TTL.
- After adding fields, update the relevant type in `src/types/` if it's a shared
  shape.

## Don't

- Don't import stores into `src/types/` or the api layer — circular deps.
- Don't mutate state objects directly — use store actions.
- Don't create a new store without a clear reason — check existing stores first.
