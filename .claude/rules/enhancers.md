# Writing & Modifying Enhancers

## Creating a New Enhancer
1. Choose the right base class:
   - `BaseEnhancer` — general purpose
   - `BaseCartEnhancer` — needs cart store awareness
   - `BaseActionEnhancer` — button/trigger that fires an action
   - `BaseDisplayEnhancer` — reactive display from store state
2. Place in the correct `src/enhancers/<category>/` folder
3. Name: `<FeatureName>Enhancer.ts` (flat file) or `<FeatureName>/` folder — see File Structure below
4. Register in `src/enhancers/core/AttributeScanner.ts` with the `data-next-*` attribute that activates it

## File Structure

**Flat file** when the enhancer is ≤ 300 lines:
```
src/enhancers/{category}/{FeatureName}Enhancer.ts
```

**Folder** when it exceeds 300 lines — split by responsibility:
```
src/enhancers/{category}/{FeatureName}/
├── {FeatureName}Enhancer.ts           # Thin orchestrator — lifecycle, subscriptions, card/element registration (<200 lines)
├── {FeatureName}Enhancer.types.ts     # All TS interfaces and enums for this enhancer
├── {FeatureName}Enhancer.renderer.ts  # DOM rendering — functions that produce HTML or mutate the bound element
├── {FeatureName}Enhancer.handlers.ts  # Event/action handlers — async cart writes, user interaction logic
└── index.ts                           # Re-exports: class + any public types
```

Add extra files only when clearly needed (no premature splits):
```
{FeatureName}Enhancer.price.ts    # dedicated when API price-fetch logic is non-trivial
{FeatureName}Enhancer.sync.ts     # when cart-sync logic warrants isolation
evaluators/                        # when condition evaluation spans multiple domains
```

### One file, one responsibility

| File | Owns | Never contains |
|---|---|---|
| `{Feature}Enhancer.ts` | `initialize()`, `update()`, `destroy()`, store subscriptions, element registration, context factories | business logic, DOM mutation, type definitions |
| `{Feature}Enhancer.types.ts` | interfaces, enums, type aliases, context structs | logic, default values |
| `{Feature}Enhancer.renderer.ts` | pure/near-pure functions that take data and return or mutate DOM elements | store writes, async API calls |
| `{Feature}Enhancer.handlers.ts` | async action functions (cart writes, API calls, user interaction flows) | store subscriptions, DOM tree traversal |
| `index.ts` | re-exports for outside consumers | implementation details |

### Wiring sub-files into the orchestrator

Sub-files export **plain functions** (not classes). The main enhancer class creates lightweight context objects and passes them in:

```ts
// context factories live in the main class
private makeHandlerContext(): HandlerContext {
  return {
    mode: this.mode,
    logger: this.logger,
    isApplyingRef: this.isApplyingRef,
    selectCard: card => this.selectCard(card),
    getEffectiveItems: card => this.getEffectiveItems(card),
    emit: (event, detail) => this.emit(event, detail),
    // ...
  };
}

// call site
void handleCardClick(e, card, this.selectedCard, this.makeHandlerContext());
```

Mutable guard state (e.g., `isApplying`) is stored as a ref object `{ value: boolean }` so handlers can read and write it without needing `this`:
```ts
private isApplyingRef = { value: false };
```

### `AttributeScanner` import path

When an enhancer moves to a folder, update its dynamic import to point at the folder (resolved via `index.ts`):
```ts
// before
const { FooEnhancer } = await import('@/enhancers/cart/FooEnhancer');
// after
const { FooEnhancer } = await import('@/enhancers/cart/Foo');
```

### Soft line limits

| File | Limit |
|---|---|
| `{Feature}Enhancer.ts` | 200 lines |
| `{Feature}Enhancer.types.ts` | 80 lines |
| `{Feature}Enhancer.renderer.ts` | 200 lines |
| `{Feature}Enhancer.handlers.ts` | 200 lines |
| `index.ts` | 5 lines |

## data-next-* Attribute Conventions
- Prefix **all** SDK attributes with `data-next-`
- Activation attribute (what triggers instantiation): `data-next-action="<name>"` or `data-next-<feature>`
- Config attributes on the same element: `data-next-package-id`, `data-next-selector-id`, etc.
- State attributes managed by enhancers: `data-next-selected`, `data-next-loading`
- CSS classes managed by enhancers: `next-selected`, `next-in-cart`, `next-unavailable`

## Lifecycle
```
constructor(element) → initialize() → update(data?) → destroy()
```
- `initialize()`: read attributes, set up store subscriptions, attach DOM event listeners
- `update(data?)`: re-render / re-sync element with current state
- `destroy()`: call `super.destroy()` first, then remove any manually added event listeners via `cleanupEventListeners()`

## Store Subscriptions in Enhancers
Use `this.subscribe()` — it auto-registers the unsubscribe for cleanup:
```ts
this.subscribe(useCartStore, state => {
  this.update(state);
});
```
Do NOT call `useCartStore.subscribe()` directly in enhancers — it bypasses auto-cleanup.

## Logging
Use the inherited `this.logger` (scoped to the enhancer class name automatically):
```ts
this.logger.debug('Initialized with package', packageId);
this.logger.warn('Missing required attribute');
this.logger.error('Failed to add to cart', error);
```
Do NOT use `console.log` — ESLint will warn on it.

## Error Handling
- Wrap async operations in try/catch and log via `this.logger.error`
- Use `this.getRequiredAttribute(name)` for required `data-next-*` attributes — it throws a clear error if missing
- Never silently swallow errors
