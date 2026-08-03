# Feature Authoring (creating & modifying a feature)

Today a feature is an **enhancer** (a `data-next-*`-activated DOM class). After
migration it moves to `features/<domain>/` but keeps the same **layer split**
(orchestrator + handlers + renderer + types) — only the folder name changes.
Correctness invariants are in [behavior-contracts.md](behavior-contracts.md);
this file is the how-to.

---

## Choosing the base class

| Feature type | Base class |
|---|---|
| General purpose | `BaseEnhancer` |
| Reads cart state reactively (e.g. quantity control) | `BaseCartEnhancer` |
| Button/trigger firing an async cart or order action (add-to-cart, accept-upsell) | `BaseActionEnhancer` |
| Reactive display from store state | `BaseDisplayEnhancer` |
| Selection, list rendering, plain display | `BaseEnhancer` |

## Creating a new feature

1. Pick the base class above.
2. Place it in the correct category folder (`cart/`, `display/`, `checkout/`,
   `order/`, `ui/`, `behavior/` — target: `features/<domain>/`).
3. Name `<feature>.enhancer.ts` (flat file) or `<feature>/` (folder), kebab-case.
4. **Register in `AttributeScanner`** with the `data-next-*` attribute that
   activates it — or it never instantiates.

File names are **kebab-case with a dotted role suffix** (`<name>.<role>.ts`); the
class inside stays PascalCase. Full rule: `.claude/rules/typescript.md`.

## File structure — flat vs folder

**Flat file** when ≤ ~300 lines: `{category}/<feature>.enhancer.ts`
(e.g. `cart/add-to-cart.enhancer.ts`).

**Folder** when it exceeds ~300 lines — split by responsibility:

```
{category}/<feature>/               # e.g. cart/add-to-cart/
├── index.ts                        # Re-exports: class + public types
├── <feature>.enhancer.ts           # Thin orchestrator — lifecycle, subscriptions,
│                                    #   element/card registration (<200 lines)
├── <feature>.handlers.ts           # Event/action handlers — async cart writes, interaction
├── <feature>.renderer.ts           # DOM rendering — produce HTML / mutate the element
├── <feature>.types.ts              # All TS interfaces/enums for this feature
├── tests/                          # Colocated unit tests — one <name>.test.ts per source file
└── guide/                          # Feature docs (see .claude/rules/guide.md)
```

**Tests live with the feature**, colocated in `tests/` — not in a distant
central folder. One `<source>.test.ts` per source file it covers
(`bundle-selector.handlers.ts` → `tests/handlers.test.ts`). Moving a feature
moves its tests with it.

Extra files only when clearly needed (no premature splits): `<feature>.price.ts`
(non-trivial price fetch), `<feature>.sync.ts` (cart-sync isolation),
`evaluators/` (multi-domain condition eval).

### One file, one responsibility

| File | Owns | Never contains |
|---|---|---|
| `<feature>.enhancer.ts` | `initialize()`, `update()`, `destroy()`, subscriptions, element registration, context factories | business logic, DOM mutation, type defs |
| `<feature>.types.ts` | interfaces, enums, type aliases, context structs | logic, default values |
| `<feature>.renderer.ts` | pure/near-pure functions: data → DOM | store writes, async API calls |
| `<feature>.handlers.ts` | async actions (cart writes, API, interaction flows) | store subscriptions, DOM tree traversal |
| `index.ts` | re-exports for outside consumers | implementation details |
| `tests/` | colocated unit tests — one `<name>.test.ts` per source file | tests for other features |

### Soft line limits

| File | Limit |
|---|---|
| `<feature>.enhancer.ts` | 200 |
| `<feature>.types.ts` | 80 |
| `<feature>.renderer.ts` | 200 |
| `<feature>.handlers.ts` | 200 |
| `index.ts` | 5 |

### Wiring sub-files into the orchestrator

Sub-files export **plain functions** (not classes). The orchestrator builds
lightweight context objects and passes them in, so handler/renderer functions
receive their dependencies as arguments instead of importing singletons:

```ts
// context factory lives in the orchestrator class
private makeHandlerContext(): HandlerContext {
  return {
    mode: this.mode,
    logger: this.logger,
    isApplyingRef: this.isApplyingRef,
    selectCard: card => this.selectCard(card),
    emit: (event, detail) => this.emit(event, detail),
    // ...
  };
}
// call site
void handleCardClick(e, card, this.selectedCard, this.makeHandlerContext());
```

Mutable guard state (e.g. `isApplying`) is a ref object `{ value: boolean }` so
handlers read/write it without `this`:
```ts
private isApplyingRef = { value: false };
```

When a feature moves to a folder, update its dynamic import to the folder
(resolved via `index.ts`):
```ts
// before: await import('@/enhancers/cart/FooEnhancer')
// after:  await import('@/features/cart/foo')   // resolves via foo/index.ts
```

---

## `data-next-*` attribute conventions

- Prefix **all** SDK attributes with `data-next-`.
- Activation attribute (triggers instantiation): `data-next-action="<name>"` or
  `data-next-<feature>`.
- Config attributes on the same element: `data-next-package-id`,
  `data-next-selector-id`, etc.
- State attributes managed by the feature: `data-next-selected`,
  `data-next-loading`.
- CSS classes managed by the feature: `next-selected`, `next-in-cart`,
  `next-unavailable`.

## Lifecycle

```
constructor(element) → initialize() → update(data?) → destroy()
```
- `initialize()`: read attributes, set up store subscriptions, attach listeners.
- `update(data?)`: re-render / re-sync with current state.
- `destroy()`: `super.destroy()` first, then remove manual listeners via
  `cleanupEventListeners()`.

## Subscriptions, logging, errors

See [behavior-contracts.md](behavior-contracts.md): use `this.subscribe()`;
`this.logger.{debug,warn,error}` not `console.log`; try/catch around async with
`this.logger.error`; `this.getRequiredAttribute()` for required attributes.

## Sync rule — guide docs

If you change a feature's attributes, events, errors, or business rules, update
its `guide/` docs in the same change (see `.claude/rules/guide.md`).
