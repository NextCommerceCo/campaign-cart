# Bundling Rules

Applies to every file under `src/` and to `vite.config.ts` › `manualChunks`.

> One failure has now shipped three times, in three different chunks, and each time
> it read as a different bug. This file is the short, non-negotiable **policy** that
> stops the fourth. The gates that enforce it are named in §4.

---

## 1. The failure, once

`manualChunks` splits `src/` into chunks that import each other in cycles. ES
modules evaluate one side of a cycle first, so any **module-scope** call that
crosses a chunk boundary can land in a `class` or `const` the other chunk has not
evaluated yet. The result is always the same line, in minified code, on a line no
source map explains:

```
ReferenceError: Cannot access 'o' before initialization
```

Evaluating `dist/index.js` then throws, `public/loader.js` catches it, and every
visitor silently downloads `dist/index.umd.js` instead. **The page still works.**
That is the whole problem: nothing fails loudly, so it ships and sits there.

| Shipped | Chunk | What ran at module scope |
|---|---|---|
| v0.4.31 ([#77]) | `state` | `new StorageManager()` calling `createLogger` |
| (caught in review) | `debug` | `highlight.js` routed to `debug`, pulling CJS helpers in |
| v0.4.35–v0.4.37 ([#93]) | `debug` | `DebugOverlay.getInstance()`, whose panels subscribe to `useCartStore` |

[#77]: https://github.com/NextCommerceCo/campaign-cart/issues/77
[#93]: https://github.com/NextCommerceCo/campaign-cart/issues/93

## 2. The rule: module scope does no work

A module body in `src/` may **declare**. It may not **run** anything that reaches
another chunk.

Allowed at module scope:

| Allowed | Why it is safe |
|---|---|
| `class` / `function` / `type` declarations | Nothing executes |
| Literals, plain objects, frozen constant maps | Nothing crosses a boundary |
| `createLogger(…)`, `EventBus.getInstance()`, `sessionStorageManager` | The `core-services` chunk is a leaf — it imports nothing from `src/` |

Never at module scope:

| Forbidden | Instead |
|---|---|
| `export const x = Something.getInstance()` | Export the class; let the first caller call `getInstance()` |
| `export const x = new Something()` | Same — construct on first use |
| `useSomeStore.subscribe(…)` / `.getState()` | Do it in the method the caller invokes after boot |
| Reading config, campaign, or cart data | Same |

A constructor counts as module scope when a module-scope statement calls it. #93 was
exactly that: one `export const debugOverlay = DebugOverlay.getInstance()` pulled
eight panel constructors, and one of them subscribed to a store in another chunk.

**Class-field initialisers run in the constructor, not at module init**, so
`icon = lucide('cart')` is fine — it is the `getInstance()` at module scope that
made it run early.

## 3. Adding or moving a `manualChunks` rule

- **`core-services` stays a leaf.** It holds `core/{logger,storage,events}.ts`,
  plus `core/flatten-texts.ts`, which imports nothing, and is the one chunk every
  other chunk calls while its own body is still running. Adding an import from the
  rest of `src/` into any of those files forfeits the only guarantee in the build.
- **Never route a `node_modules` package to a `src/` chunk.** A bundler puts shared
  CJS-interop helpers wherever the package lands, and that gives `vendor` an
  outgoing edge into `src/`. The size win is not worth it.
- **A new edge between named chunks is a decision.** `src/tests/contract/es-bundle-init.test.ts`
  freezes the graph; read its `FROZEN_CHUNK_GRAPH` comment before changing the map.

## 4. The gates, and what each one cannot see

| Gate | Proves |
|---|---|
| `src/tests/contract/es-bundle-init.test.ts` | The built graph evaluates without throwing, under **every** boot condition in its `BOOTS` list. Runs in CI. |
| `e2e/es-bundle.spec.ts` | Five real engines agree, and the loader stayed on the module path. **CI does not run this** ([e2e.md](./e2e.md) §5). |
| The frozen chunk graph, same file | The hazard surface did not silently grow. |

Two things they cannot do:

- **They read the committed `dist/`, not your working tree.** Run `npm run build`
  before trusting a pass about your edit.
- **They only cover the boot conditions listed.** A module body that starts
  branching on something new — a URL parameter, a meta tag, a `window` global —
  needs a row added to `BOOTS`. #93 shipped through a green run of this exact test
  because the flag it needed (`?debugger=true`) was not in the list.

---

## Checklist (run before calling a change done)

- [ ] No new module-scope statement calls a constructor, `getInstance()`, or a store.
- [ ] `npm run build`, then `npx vitest run src/tests/contract/es-bundle-init.test.ts`.
- [ ] If a module body now branches on a new input, `BOOTS` has a row for it.
- [ ] If the frozen chunk graph changed, the diff was read and the new edge is deliberate.
- [ ] `npm run test:e2e -- e2e/es-bundle.spec.ts` on all five projects.
