# Zustand Rules

## File structure

Every feature with a store follows this layout:

```
src/
├── api/
│   └── {feature}.api.ts        # Pure fetch/axios calls only
├── store/
│   └── {feature}/
│       ├── {feature}Store.ts       # create() + compose slices + middleware
│       ├── {feature}Store.types.ts # All TS interfaces for this store
│       ├── {feature}Slice.items.ts # Sync state mutations
│       ├── {feature}Slice.ui.ts    # UI-only state (open, loading flags, step)
│       └── {feature}Slice.api.ts   # Async actions that call the API layer
└── index.ts                    # Re-export public API only
```

---

## One file, one responsibility

| File | Owns | Never contains |
|---|---|---|
| `{feature}.api.ts` | fetch/axios calls, returns typed data or throws | `set()`, `get()`, any Zustand import |
| `{feature}Store.types.ts` | interfaces, enums, type aliases | logic or default values |
| `{feature}Slice.items.ts` | sync `set()` mutations | API calls, `fetch`, `async` |
| `{feature}Slice.ui.ts` | loading flags, open/close, step state | business data, API calls |
| `{feature}Slice.api.ts` | async actions, calls API layer, writes result via `set()` | raw `fetch` — import from `{feature}.api.ts` instead |
| `{feature}Store.ts` | `create()`, composes slices, applies middleware | any state or actions directly |
| `index.ts` | re-exports for outside consumers | implementation details |

---

## Rules

### API layer (`{feature}.api.ts`)
- Contains `fetch` or `axios` calls only — no Zustand code whatsoever
- Every function returns typed data or throws a meaningful error
- No side effects, no global state — purely functional
- Easily testable and mockable in isolation

```ts
// good
export const cartApi = {
  fetchCart: async (): Promise<CartItem[]> => {
    const res = await fetch('/api/cart')
    if (!res.ok) throw new Error('Failed to fetch cart')
    return res.json()
  },
}

// bad — fetch inside a slice
fetchCart: async () => {
  const res = await fetch('/api/cart') // belongs in cart.api.ts
  ...
}
```

### Async slice (`{feature}Slice.api.ts`)
- Imports from the API layer — never calls `fetch` directly
- Always sets loading and error state around the call
- Uses `get()` to read current state when building request payloads

```ts
fetchCart: async () => {
  set({ isLoading: true, error: null })
  try {
    const items = await cartApi.fetchCart()
    set({ items, isLoading: false })
  } catch (e) {
    set({ error: (e as Error).message, isLoading: false })
  }
},
```

### Sync slice (`{feature}Slice.items.ts`)
- Pure `set()` mutations only — no `async`, no `fetch`
- Each action does one thing
- Prefer functional updates `set(s => ...)` when reading previous state

```ts
// good
addItem: (item) => set((s) => ({ items: [...s.items, item] })),

// bad — reading stale state
addItem: (item) => set({ items: [...get().items, item] }),
```

### Store composer (`{feature}Store.ts`)
- Must stay under ~30 lines
- Only responsibility: call `create()`, spread slices, apply middleware
- Middleware order: `devtools( persist( immer( ...slices ) ) )`
- Never define state or actions directly here

```ts
export const useCartStore = create<CartState>()(
  devtools(
    persist(
      (...a) => ({
        ...createCartItemsSlice(...a),
        ...createCartApiSlice(...a),
        ...createCartUiSlice(...a),
      }),
      { name: 'cart-storage' }
    )
  )
)
```

### Types (`{feature}Store.types.ts`)
- All interfaces for state AND slice interfaces live here
- `CartState` = union of all slice interfaces — used as the generic for `create<CartState>()`
- No logic, no default values — types only

```ts
export interface CartItem { id: string; name: string; qty: number; price: number }
export interface CartState extends CartItemsSlice, CartApiSlice, CartUiSlice {}
```

### Selectors
- Always use a selector function — never destructure the whole store
- Co-locate derived/computed selectors near the store, not in components

```ts
// good — only re-renders when items changes
const items = useCartStore((s) => s.items)

// bad — re-renders on every store change
const { items } = useCartStore()
```

### Public API (`index.ts`)
- Outside code imports from `index.ts` only — never from internal slice files
- Export the hook, export types that consumers need, nothing else

```ts
export { useCartStore } from './store/cartStore'
export type { CartItem, CartState } from './store/cartStore.types'
```

---

## File size limits (guidelines)

| File | Soft limit |
|---|---|
| `{feature}Store.ts` | 30 lines |
| `{feature}Store.types.ts` | 80 lines |
| `{feature}Slice.*.ts` | 100 lines |
| `{feature}.api.ts` | 120 lines |

If any file exceeds its limit, split by sub-domain (e.g. `cartSlice.items.ts` → `cartSlice.items.ts` + `cartSlice.coupon.ts`).

---

## When to create a new slice

Split into a new slice file when a group of state + actions:
- Can be described independently (items vs. checkout vs. ui)
- Would make the current file exceed the line limit
- Has its own loading/error state cycle

Do **not** create a new store per component — stores are feature-level, not component-level.