# Writing & Modifying Enhancers

## Creating a New Enhancer
1. Choose the right base class:
   - `BaseEnhancer` — general purpose
   - `BaseCartEnhancer` — needs cart store awareness
   - `BaseActionEnhancer` — button/trigger that fires an action
   - `BaseDisplayEnhancer` — reactive display from store state
2. Place in the correct `src/enhancers/<category>/` folder
3. Name: `<FeatureName>Enhancer.ts`
4. Register in `src/enhancers/core/AttributeScanner.ts` with the `data-next-*` attribute that activates it

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
