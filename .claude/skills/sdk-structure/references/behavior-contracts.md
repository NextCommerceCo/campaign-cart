# Behavior Contracts (invariants that survive every rename)

These are correctness contracts, not layout preferences. They hold whether the
folder is called `enhancers/`/`stores/` (today) or `features/`/`state/`
(target). **Read this before touching any feature or store.** Breaking one of
these breaks production even when types and unit tests pass.

---

## Public contract (never change without approval)

- Everything exported from `src/index.ts`.
- The `data-next-*` attribute surface and emitted events customers wire to.
- Global event names live on `EventMap` in `src/types/global.ts` — every event
  type must be declared there.

---

## Store / state access

- **`campaignStore` field is `.data`, not `.campaign`.** Always
  `useCampaignStore.getState().data`. `.campaign` is `undefined` and silently
  breaks code.
- **One-time read:** `useXxxStore.getState()`. **Reactive read inside a
  feature:** `this.subscribe(useXxxStore, state => …)` — never call
  `useXxxStore.subscribe()` directly (it bypasses auto-cleanup on `destroy()`).
- **Never instantiate stores directly** — always the exported hook / `getState()`.
- **Display features are read-only observers** — never call `setState` from a
  display feature.
- **Never mutate state objects directly** — always go through store actions.
- Prefer the **EventBus** for cross-feature communication over direct writes
  into another feature's store.

## Persistence & TTL

- `cartStore` and `campaignStore` use `persist` (sessionStorage); `orderStore`
  has a 15-minute expiry. New fields inherit the persistence / TTL behaviour.
- **Never rename a store's `persist` key** during a move/refactor — it
  invalidates live customer sessions.

## Lifecycle & cleanup

- Lifecycle is `constructor(element) → initialize() → update(data?) → destroy()`.
- **Call `super.destroy()` first** when overriding `destroy()`, then remove any
  manually added listeners via `cleanupEventListeners()`.
- Store subscriptions via `this.subscribe()` auto-unsubscribe on `destroy()`.
- **Never manipulate the DOM outside the feature's bound `this.element`.**

## Logging & errors

- **No `console.log`** — use `this.logger.{debug,warn,error}` (scoped to the
  class name automatically). ESLint flags `console.log`.
- Wrap async operations in try/catch and log via `this.logger.error`; never
  silently swallow errors.
- Use `this.getRequiredAttribute(name)` for required `data-next-*` attributes —
  it throws a clear error if missing.

## Registration & dependency direction

- **Register every feature in `AttributeScanner`** with its activation attribute
  (`src/core/attribute-scanner.ts`), or it never instantiates.
- A feature is loaded by a dynamic `import('@/features/…')` from the scanner — it
  resolves via the folder's `index.ts`.
- `api/` (target `core/http`) does I/O only — no store imports, no Zustand.
- `utils/` are pure — no store imports (circular-dep risk).

---

## Cart-specific contracts (`enhancers/cart/` → `features/cart/`)

### Selector ↔ AddToCart contract
`PackageSelectorEnhancer` exposes on the DOM element after init:
- `element._getSelectedItem()` → `SelectorItem | null`
- `element._getSelectedPackageId()` → `number | undefined`

`AddToCartEnhancer` calls these when given a `data-next-selector-id`. The
container also gets `data-selected-package` — read it via
`getAttribute('data-selected-package')` when outside an enhancer.

### swap vs select mode
Default is **swap** — selecting a card immediately calls
`cartStore.swapPackage()`. Use **select** when a button initiates add-to-cart.
**Do not** put swap-mode `PackageSelectorEnhancer` on a selector that also feeds
an `AddToCartEnhancer` — the card click and the button each fire a cart write =
double cart writes.

### Bundles
Use `BundleSelectorEnhancer` for any multi-package bundle — not multiple
`CartToggleEnhancer` (toggle is not atomic and cannot cleanly remove the
previous bundle). Bundle vouchers via `data-next-bundle-vouchers` are
auto-applied/removed on bundle select/deselect — do NOT also manage them via
`CouponEnhancer`.

### CartToggle sync
`data-next-package-sync="2,4,9"` mirrors the total quantity of the listed
packages; when all synced packages are removed, the toggle item is removed too.
Do **not** use `data-next-qty-sync` in new code (legacy single-package alias) —
always `data-next-package-sync`.

### Template re-render safety
`CartItemListEnhancer` and `CartSummaryEnhancer` replace their entire
`innerHTML` on every cart store update. **Never attach event listeners directly
to their rendered children** — they are destroyed on every re-render.
`CartItemListEnhancer` auto-initializes `QuantityControlEnhancer` and
`RemoveItemEnhancer` on `[data-next-quantity]` / `[data-next-remove-item]` after
each render — do not manually instantiate these inside item templates.

### AcceptUpsell constraints
- Writes to the **order** (post-purchase API), not the cart store — never call
  `cartStore` actions from this feature or alongside it for the same package.
- Active only when `orderStore.canAddUpsells()` is true; the button is disabled
  otherwise.
- Duplicate detection is via `orderStore.completedUpsells`, not cart state.
