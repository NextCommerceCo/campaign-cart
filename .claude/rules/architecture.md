# Architecture Rules

## Enhancer Pattern
All DOM-interactive features use **enhancer classes** bound to `data-next-*` attributes:
- Extend `BaseEnhancer` (or `BaseCartEnhancer`, `BaseActionEnhancer` for specialized variants)
- Implement `initialize()` and `update()` lifecycle methods
- Call `super.destroy()` when overriding `destroy()` — it unsubscribes all store/event subscriptions
- Register store subscriptions via `this.subscribe(store, listener)` so they auto-cleanup on destroy
- Never manipulate DOM directly outside the enhancer's bound `this.element`

## Store Access
- **From inside an enhancer**: use `this.subscribe(useXxxStore, state => ...)` for reactive updates; use `useXxxStore.getState()` for one-time reads
- **From anywhere**: use `useXxxStore.getState()` — never instantiate stores directly
- **`campaignStore` field is `.data`**, not `.campaign` — always `useCampaignStore.getState().data`
- Never call `setState` from a display enhancer; display enhancers are read-only observers

## EventBus
- Emit and listen via `this.emit(event, detail)` and `this.on(event, handler)` inside enhancers
- Outside enhancers: use `EventBus.getInstance().emit(...)` / `.on(...)`
- All event types must be declared in `src/types/global.ts` → `EventMap`
- Prefer EventBus for cross-enhancer communication over direct store writes

## File Organization
- `src/enhancers/cart/` — cart interaction (add, remove, quantity, toggle)
- `src/enhancers/display/` — reactive DOM updates from store data
- `src/enhancers/checkout/` — checkout form/flow
- `src/enhancers/order/` — post-purchase (upsell, order items)
- `src/enhancers/ui/` — pure UI (accordion, tooltip, scroll hint)
- `src/enhancers/behavior/` — behavioral (FOMO, exit intent)
- `src/stores/` — Zustand stores only; no business logic beyond state transitions
- `src/utils/` — pure utilities; no store imports unless clearly a bridge utility

## Singleton Services
EventBus, Logger, and NextCommerce are singletons — always get via `.getInstance()`, never `new`.
