# Core Enhancers

The core files in `src/enhancers/core/` are the SDK entry point and DOM orchestration layer. They are not enhancers that users interact with directly — they wire everything together at initialization time.

## Files

| File | Class | Role |
|---|---|---|
| `SDKInitializer.ts` | `SDKInitializer` | Static class; SDK bootstrap and configuration loading |
| `AttributeScanner.ts` | `AttributeScanner` | DOM scan, enhancer instantiation, dynamic DOM observation |

---

## SDKInitializer

**Static class** — all methods are `static`. Entry point for the entire SDK.

### `SDKInitializer.initialize()`

The main entry point. Called once when the SDK script loads. Orchestrates:

1. **Wait for DOM** (`DOMContentLoaded` or immediate if already ready)
2. **Load configuration** from `useConfigStore` — reads `<meta name="next-*">` tags or `window.NextCommerceConfig`
3. **Load campaign data** — calls `useCampaignStore.loadCampaign()` with a 10-minute `sessionStorage` cache; records load time
4. **Load profiles** — if campaign has pricing profiles, loads them into `profileStore`
5. **Load attribution** — captures UTM params, ref IDs, and other URL params via `attributionStore`
6. **Initialize cart** — restores any persisted cart state from `localStorage`
7. **Initialize checkout store** — prepares form state
8. **Run `AttributeScanner.scanAndEnhance(document.body)`** — instantiates all enhancers
9. **Set up test mode** — if `?next_test=true` in URL, enables debug overlay
10. **Emit `sdk:ready`** event and dispatch `next:ready` CustomEvent on `window`

### Retry Logic

If campaign data fails to load, `SDKInitializer` retries up to 3 times (`maxRetries`) before giving up. Errors are logged but do not prevent the scanner from running (page still enhances with what data is available).

### Guards

- `initialized` flag prevents double-initialization
- Logs a warning if `initialize()` is called again after already running

### Country / Location

Calls `CountryService.getLocation()` to detect user country/region. This is used by profile loading and may influence which pricing profile is auto-applied.

---

## AttributeScanner

Scans the DOM for `data-next-*` attributes and instantiates the correct enhancer class for each element. Also observes the DOM for dynamically added/removed elements.

### `scanAndEnhance(root: Element)`

Main scan method called by `SDKInitializer`. Steps:

1. Queries the DOM for all known `data-next-*` attribute selectors (see full list in source)
2. Processes elements in **batches of 10** with `setTimeout(0)` yield between batches to avoid blocking the main thread
3. For each element: calls `AttributeParser.getEnhancerTypes(element)` to determine which enhancer class(es) to create
4. Calls `createEnhancer(type, element)` → lazy `import()` → `new EnhancerClass(element)`
5. Calls `enhancer.initialize()`
6. Stores enhancers in a `WeakMap<HTMLElement, BaseEnhancer[]>` for automatic GC
7. After scan: adds `next-display-ready` class to `<html>` and dispatches `next:display-ready` CustomEvent
8. Starts `DOMObserver` to watch for future DOM changes

### Enhancer Type Routing (`createEnhancer`)

`AttributeParser.getEnhancerTypes()` returns type strings. `createEnhancer` maps them:

| Type string | Enhancer Class | Notes |
|---|---|---|
| `display` | `CartDisplayEnhancer` / `ProductDisplayEnhancer` / `SelectionDisplayEnhancer` / `OrderDisplayEnhancer` / `ShippingDisplayEnhancer` | Routed by `parseDisplayPath()` object prefix |
| `toggle` | `CartToggleEnhancer` | |
| `action` | `AddToCartEnhancer` or `AcceptUpsellEnhancer` | Routed by `data-next-action` value |
| `selector` | `PackageSelectorEnhancer` | |
| `timer` | `TimerEnhancer` | |
| `conditional` | `ConditionalDisplayEnhancer` | |
| `checkout` | `CheckoutFormEnhancer` | |
| `checkout-review` | `CheckoutReviewEnhancer` | |
| `express-checkout-container` | `ExpressCheckoutContainerEnhancer` | |
| `cart-items` | `CartItemListEnhancer` | |
| `order-items` | `OrderItemListEnhancer` | |
| `quantity` | `QuantityControlEnhancer` | |
| `remove-item` | `RemoveItemEnhancer` | |
| `upsell` | `UpsellEnhancer` | |
| `coupon` | `CouponEnhancer` | |
| `accordion` | `AccordionEnhancer` | |
| `tooltip` | `TooltipEnhancer` | |
| `scroll-hint` | `ScrollHintEnhancer` | |
| `quantity-text` | `QuantityTextEnhancer` | |
| `profile-switcher` | `ProfileSwitcherEnhancer` | |
| `profile-selector` | `ProfileSelectorEnhancer` | |

All enhancer imports are **dynamic (`import()`)** — code-split by enhancer type to reduce initial bundle size.

### Template Variable Protection

Before enhancing an element, `AttributeScanner` skips:
- Elements inside `[data-next-cart-items]` containers (they contain `{item.xxx}` template placeholders)
- Elements whose `data-package-id` attribute contains `{` and `}` (literal template variables)

### Dynamic DOM Observation

After initial scan, `DOMObserver` watches for mutations:
- **Element added** → queued for enhancement (debounced 50ms)
- **Element removed** → `enhancer.destroy()` called, removed from WeakMap
- **`data-next-*` attribute changed** → old enhancers destroyed, element re-queued

### Memory Management

- `WeakMap<HTMLElement, BaseEnhancer[]>` — enhancers are automatically garbage-collected when their DOM elements are removed
- `enhancerCount` tracks the count separately (WeakMap has no `.size`)
- `destroy()` clears the scan queue and stops DOMObserver (individual enhancers GC'd naturally)

### Debug Mode

If `?debug=true` is in the URL, `AttributeScanner` measures and logs per-enhancer-type initialization time:

```
Enhancement Performance Report
┌──────────┬────────────────┬─────────────────┬───────┬────────────┐
│ Enhancer │ Total Time(ms) │ Average Time(ms) │ Count │ Impact     │
├──────────┼────────────────┼─────────────────┼───────┼────────────┤
│ checkout │ 82.50          │ 82.50           │ 1     │ 🔴 High   │
│ display  │ 14.20          │ 1.42            │ 10    │ 🟡 Medium │
└──────────┴────────────────┴─────────────────┴───────┴────────────┘
```

### `getStats()`

Returns current scanner state:
```ts
{
  enhancedElements: number,
  queuedElements: number,
  isObserving: boolean,
  isScanning: boolean,
  performanceStats?: Record<string, { totalTime, averageTime, count }> // debug mode only
}
```

### Control Methods

| Method | Description |
|---|---|
| `scanAndEnhance(root)` | Initial full DOM scan |
| `pause()` | Pause DOM observation |
| `resume(root?)` | Resume DOM observation |
| `destroy()` | Stop observer, clear queue |
| `getStats()` | Current stats snapshot |

### SDK Lifecycle Events

| Event | When | How |
|---|---|---|
| `next:display-ready` | After initial scan completes | `window.dispatchEvent(new CustomEvent(...))` |
| `next-display-ready` | Same | `document.documentElement.classList.add(...)` |
| `sdk:ready` | After full SDK init | EventBus |
| `next:ready` | After full SDK init | `window.dispatchEvent(...)` |
