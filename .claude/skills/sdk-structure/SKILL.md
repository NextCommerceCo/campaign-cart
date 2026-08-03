---
name: sdk-structure
description: >-
  File structure and refactoring methodology for the Campaign Cart SDK. Load
  when creating, moving, splitting, or renaming files; deciding where new code
  belongs (feature vs state vs core vs util); refactoring the folder layout; or
  migrating enhancers→features / stores→state. Covers the TARGET layout
  (features/state/core/types/utils + client.ts DI), dependency direction, the
  DOM-activation model, feature/state anatomy, the IApiClient injection
  redesign, TypeDoc conventions, and the safe phased-migration workflow
  (contract test → shim → one file at a time). Reference files carry the durable
  behavior contracts and the per-feature / per-store authoring rules.
---

# SDK Structure & Refactor

How to structure, move, and split files in the Campaign Cart SDK, and how to
migrate safely toward the target layout. These encode deliberate decisions — do
not "improve" the structure by ignoring them.

> **The folder migration is done** (2026-08-02). `features/`, `state/` and `core/`
> are the real layout — `enhancers/` and `stores/` no longer exist, and the
> "Today → Target" table in §1 is history rather than a plan. What is **not**
> finished is the injection redesign in §6: `src/client.ts` is the only place a
> client is constructed, but features still *fetch* their dependencies from it
> rather than receiving them, and `.getInstance()` singletons remain. Read §6
> before assuming a layer is wired the way §1 draws it.

## Reference files (read the one that fits the task)

- **[references/behavior-contracts.md](references/behavior-contracts.md)** —
  invariants that survive every rename: `.data` not `.campaign`, `persist`/TTL,
  `super.destroy()`, `this.subscribe`, AttributeScanner registration, no
  `console.log`, EventBus/EventMap, and the cart-specific contracts
  (selector↔AddToCart, swap-vs-select, bundles, template re-render safety,
  AcceptUpsell). **Read before touching any feature or store.**
- **[references/feature-authoring.md](references/feature-authoring.md)** — how to
  create/modify a feature (today: an enhancer): base-class choice, lifecycle,
  file splitting, sub-file wiring, `data-next-*` conventions, logging, errors.
- **[references/state-authoring.md](references/state-authoring.md)** — how to
  write a store/state: slice layout, api layer, selectors, size limits,
  persistence, the store list.

Cross-cutting rules stay in `.claude/rules/`: `typescript.md` (path aliases,
strict mode), `testing.md` (Vitest/Playwright), `guide.md` (per-feature `guide/`
docs). This skill does not duplicate them.

---

## 0. Golden rules (read first)

1. **The public contract is frozen.** This SDK runs on live customer pages. Two
   things are the contract and must not change without explicit approval:
   (a) everything exported from `src/index.ts`, and (b) the **`data-next-*`
   attribute + emitted-event surface** customers wire their HTML to. Internals
   can be rearranged freely — the outside world only sees these two.
2. **Refactor moves code; it does not change behavior.** Renaming folders and
   moving files is a refactor. Switching singletons → dependency injection is a
   **redesign** (§6) — do it as its own phased step, never mixed into a move.
3. **Small changes, tests green at every step.** The SDK stays deployable at
   every point — no half-migrated states. (Leave the tree green; a local commit
   per step is fine, but never push.)
4. **Use names a newcomer understands without a glossary.** Target names —
   `features/`, `state/`, `core/`, `types/`, `utils/` — say what they hold on
   sight. This is why we move off `enhancers/`/`stores/`: they require learning
   the codebase first.

---

## 1. Top-level layout

```
src/
├── index.ts        # 🔒 FROZEN public API — the only export surface for consumers
├── client.ts       # Composition root — creates instances, injects dependencies, wires all
│
├── features/       # ★ What the SDK DOES — one folder per domain (cart, checkout, upsell…)
├── state/          # ★ Mutable reactive state (Zustand), shared across features. Was stores/
├── core/           # ★ Internal engine (@internal): events, storage,
│                   #     config, errors, plus the DOM-activation engine (AttributeScanner,
│                   #     SDKInitializer, base feature class)
├── types/          # Shared cross-cutting types + EventMap
├── utils/          # Small pure helpers
└── styles/         # CSS shipped with the SDK (imported by index.ts — a real side effect)
```

Supporting (repo root): `examples/`, `tests/`, `docs/`, `typedoc.json`,
`vite.config.ts`, `package.json`, `README.md`.

**Today → Target map** (nothing is renamed until its migration phase):

| Today | Target | Note |
|---|---|---|
| `enhancers/{cart,checkout,order,…}/` | `features/{cart,checkout,upsell,…}/` | domain features |
| `enhancers/core/` (AttributeScanner, SDKInitializer), `enhancers/base/` | `core/` | activation engine + base class |
| `stores/` | `state/` (`*.state.ts`) | keep `persist` keys unchanged |
| `core/NextCommerce.ts` | `client.ts` + `core/` | composition root |
| `utils/events.ts`, `utils/logger.ts` | `core/events.ts`, `core/logger.ts` ✅ done | still `.getInstance()` singletons; injection is a later phase |
| `utils/storage.ts`, `utils/testMode.ts`, `utils/countryService.ts`, `utils/monitoring/`, `utils/attribution/` | `core/*` ✅ done | shared infra + SDK-init subsystems, not features |
| `api/client.ts` | **stays** `api/client.ts` (+ `api/client.types.ts` → `IApiClient`) ✅ done | the seam shipped 2026-07-31. Renaming it `core/http.ts` would misname it: it is the typed endpoint client, not a transport facade — §6 |
| `utils/analytics/` | `core/analytics/` ✅ done | cross-cutting subsystem, not a feature; stays a lazy `analytics` chunk |
| `utils/debug/` | `core/debug/` ✅ done | code-split via dynamic `import()` so it never ships in prod |

After this pass `utils/` holds only pure, cross-feature helpers — today that is
`cookies.ts` and `voucher.ts`. `currencyFormatter` and `url-utils` ended up in
`core/` rather than here, and domain calculators moved to their layer
(`CartCalculator` → `state/cart/`, `PriceCalculator` → `features/display/`).

---

## 2. Dependency direction (never violate)

```
features   →  core, api (via the IApiClient interface), state, types, utils
core       →  nothing above it
state      →  nothing above it
client.ts  →  wires everything together (the only file that knows all layers)
```

- `features/` may import `core/`, `state/`, `types/`, `utils/`.
- `core/` and `state/` must NOT import `features/`.
- A feature must NOT import another feature's internal files. Shared logic
  belongs in `core/`, `state/`, or `utils/`; cross-feature signalling goes
  through the event bus in `core/`.

If you find yourself importing across features or upward, stop — the shared
piece is misplaced.

---

## 3. Activation model (the truth that survives every rename)

However folders are named, this is a **declarative DOM SDK**: a customer adds
`data-next-*` attributes to HTML and `SDKInitializer` auto-inits. The
`AttributeScanner` (in `core/`) discovers matching elements and instantiates the
feature bound to each one.

So a feature is **DOM-bound**, not a free-standing service:

- `client.ts` builds the shared dependencies (the API client, `state`, event bus)
  once and hands them to features — features never construct their own
  singletons.
- `AttributeScanner` supplies the DOM element; `client.ts` supplies the
  dependencies. Together they instantiate a feature.
- The `data-next-*` → feature mapping is part of the frozen contract (§0.1).
  Moving a feature's folder means updating the scanner's dynamic `import('…')`
  path — grep for `import(` after any move.

A future thin *programmatic* facade (`sdk.cart.addItem()`) can reuse the same
`state/` + `api/` without the DOM layer — which is exactly why business rules
live in `features`/`state`/`core`, not buried in DOM event handlers.

---

## 4. Anatomy of a feature (learn one, know them all)

Every feature has the same shape. Start as a single file; grow into a folder
only when it gets hard to read (~300 lines). Do not pre-split a small feature.
A feature is a DOM-bound enhancer, so it **splits by layer** — orchestrator /
handlers / renderer / types — not by command. Full detail:
[references/feature-authoring.md](references/feature-authoring.md).

```
features/cart/add-to-cart/         # a feature that grew past ~300 lines → folder
├── index.ts                        # ① Gate — re-exports only, NO logic
├── add-to-cart.enhancer.ts         # ② Orchestrator — lifecycle, subscriptions, DOM binding,
│                                    #     injected deps. Delegates; does no real work.
├── add-to-cart.handlers.ts         # ③ Handlers — async cart writes, user interaction
├── add-to-cart.renderer.ts         # ③ Renderer — data → DOM (no store writes)
├── add-to-cart.types.ts            # ④ Types local to this feature
├── tests/                          # ⑤ Colocated unit tests — one *.test.ts per source file
└── guide/                          # ⑥ Feature docs (.claude/rules/guide.md)
```

Tests are **colocated with the feature** in `tests/` and move with it — never a
distant central folder.

Files are **kebab-case with a dotted role suffix** — `<name>.<role>.ts` (roles:
`enhancer`, `handlers`, `renderer`, `types`, `state`, `slice`, `api`). The class
inside stays PascalCase (`AddToCartEnhancer`). Full rule: `.claude/rules/typescript.md`.

- **Gate** re-exports; no logic.
- **Orchestrator** coordinates: holds injected dependencies, binds to its DOM
  element, subscribes to `state/`, delegates to handler/renderer functions.
- **Handlers / Renderer** hold the logic and receive dependencies as arguments
  (context objects) — never import singletons directly.
- **Types** are local to the feature.

Command-style operation files (`add-item.ts`, `remove-item.ts`) are reserved for
a future *programmatic* facade (`sdk.cart.addItem()`), not the DOM feature (§6).

---

## 5. State placement

Decide per store by asking **who uses it?**

- **Shared by more than one feature** → central `state/` (most state is shared:
  checkout reads cart, upsell reads cart + campaign). Named `<domain>.state.ts`.
- **Used by exactly one feature** → may live inside that feature's folder; the
  moment a second feature imports it, move it to `state/`.

A store is a **state container**: state fields + sync setters only. Async /
business logic lives in the **feature** (event-driven, coordinated via EventBus),
not in the store — keep `state/` thin. **Every store is a `state/<domain>/`
folder** holding `<domain>.state.ts`, its `<domain>.state-manifest.ts`, its
`guide/`, and an `index.ts` barrel — import the folder (`@/state/order`), never
the inner file. Inside it, **one file for the store is still the default**: do
not pre-split into items/ui/api slices; add a `<sub>.slice.ts` only when the
store grows (~300 lines), by real sub-domain.
Details, persistence, and the store list: [references/state-authoring.md](references/state-authoring.md).
**Never rename a store's `persist` key during a move** — it invalidates live
customer sessions. After moving a store, confirm every import resolves to the
**same instance** (§9).

---

## 6. Engine, injection, and interfaces (the redesign — do it deliberately)

- **One HTTP facade over `fetch`** — auth, retries, timeouts, error conversion
  written once. No feature touches `fetch`. Today that is
  `ApiClient.request()` in `api/client.ts`.
- **Features depend on an interface, not the concrete class** — tests pass a
  fake; implementations can be swapped.
- **`client.ts` is the composition root**: creates the real client, event bus,
  and state, then injects them into features. Features never construct their
  own dependencies.
- **Add an interface only where it earns it**: multiple dependents, needs
  mocking, or may be swapped. The API client qualifies. Do NOT add an interface
  for every class — that is over-engineering.

### The seam is the domain methods, not `get`/`post` — **decided 2026-07-31**

This section used to name the interface `IHttpClient` and have features call
`http.get()/post()`. **That was wrong, and the shipped interface is
[`IApiClient`](../../../src/api/client.types.ts) instead** — the thirteen typed
endpoint calls (`createOrder`, `calculateSummary`, …). `setApiKey` is
deliberately **not** on it: re-keying is the composition root's job, and the
gate carries that as a named exemption rather than a silent gap.

Two different abstractions were being conflated. A *transport* facade
(`get`/`post`) is the right shape for the **inside** of the client, and
`ApiClient.request()` already is one. It is the wrong shape for a **feature** to
depend on: `http.post('/api/v1/orders/', …)` puts endpoint paths and payload
shapes inside the feature, which is exactly what `src/api/` exists to own — so
that seam would violate §2 while appearing to follow it.

So: features depend on `IApiClient`; the transport stays private to `ApiClient`.
Do not "fix" it back. Details and the rough edges in
[`src/api/README.md`](../../../src/api/README.md).

**Done so far.** `IApiClient` exists, `ApiClient implements` it, and
**`src/client.ts` is now the only place a client is constructed** —
`getApiClient(apiKey?)` memoizes one instance per page and re-creates it only
when the key changes. All twelve former `new ApiClient(…)` call sites go through
it, and every field that holds a client is typed `IApiClient`. Sharing one
instance is safe because `ApiClient` holds only a base URL, the key and a logger;
**if you add per-caller state to it, that breaks and every holder shares it.**
`src/tests/contract/api-surface.test.ts` gates the interface both directions
(because `implements` only checks one: an endpoint added to the class and missed
on the interface is otherwise silent), and
`src/tests/contract/api-client-instance.test.ts` gates the single-instance and
re-keying behaviour.

An earlier version of this paragraph said every holder was already typed at the
interface. It was wrong — only three were, and five declarations across four
files had to be widened when construction moved. Do not size this kind of work
off a "type-only half is done" claim without grepping.

**Still to do:** features and stores still *fetch* the client from the
composition root rather than *receiving* it, so `state/` (`cart-calculator.ts`,
`campaign/api.slice.ts`) and `core/` (`sdk-initializer.ts`, `next-commerce.ts`)
import `@/client`, which §2 says they must not. Closing that means changing
enhancer constructor signatures and how `AttributeScanner` instantiates features
— the next phase. The store boundary is closed: `loadOrder` and `addUpsell` both
take an `IApiClient` now, and neither change touched a caller — which is exactly
why the `any` had gone unnoticed. What still erases the seam is test-side: four
feature tests mock `@/api/client` with a fake that implements nothing, which is
why `getApiClient` has to call `instance?.getApiKey?.()` optionally rather than
plainly. Removing `Logger`/`EventBus`/`ApiClient` from `src/index.ts` remains a
**breaking public-API change needing explicit approval** (§0.1) — keep it
separate.

This section is a **redesign of today's `.getInstance()` singletons** (§0.2).
Migrate it as its own phase, behind green tests, after the folder moves.

---

## 7. Encapsulation & the public surface

- `src/index.ts` exports only what consumers should use; everything else is
  internal and free to move.
- Each folder's `index.ts` is a **barrel**: exports only, no logic.
- Mark `core/` internals and dev-only `debug/` with `@internal` so they stay out
  of public docs. Note: the current surface still exports `Logger`, `EventBus`,
  and `ApiClient` from `index.ts` — those remain public until a deliberate,
  approved surface change removes them (§0.1).

---

## 8. Documentation (TypeDoc)

**Scope (decided):** TypeDoc's only entry point is `src/index.ts` — it documents
the **public/consumer surface, not internals**. Do NOT add `features/`, `core/`,
or `state/` as entry points: internals are `@internal`/free-to-move (§0.1, §7),
and documenting them would couple the reference to internal churn. Those folders
are documented instead through the narrative **`guide/` docs** (per feature) and
short **folder `README.md`s** (`features/`, `state/`, `core/`, and subsystems
like `core/analytics/`). TypeDoc = consumer reference; guide/ + READMEs =
contributor/architecture reference.

- Every **exported (public)** symbol gets a TSDoc comment.
- `@example` on public methods — the single biggest readability win.
- `@category` to group related classes in the sidebar.
- `@internal` on internals; keep `excludeInternal: true` in `typedoc.json`.
- `{@inheritDoc}` so a thin orchestrator reuses a handler/renderer file's docs —
  write each explanation once.
- `src/index.ts` carries the `@packageDocumentation` comment (docs homepage).
- A short `README.md` in `state/` and `core/` explaining what the folder is and
  why it exists.
- Narrative `guide/` docs (`.claude/rules/guide.md`) are the product layer;
  TypeDoc is the reference layer. Cross-link — never duplicate.

---

## 9. Migration & refactor workflow (this codebase specifically)

Tests exist and the SDK is in production. Move in small, green, one-file steps.

1. Ensure a **contract test** imports through `index.ts` exactly as a consumer
   would and asserts the public surface is unchanged. Keep it green throughout.
2. Run tests → green before starting.
3. Move/rename the file into the target layout, leaving the old path
   **re-exporting** everything (a shim) so call sites don't change yet.
4. Run tests → must be green. If red, you moved something wrong; fix now.
5. Leave the tree green. Repeat one file at a time. Remove shims in a final
   sweep once all internal imports point at the new path.

**Sequence:** rename/move folders first (pure refactor, shims everywhere), then
do the injection/interface redesign (§6) as separate phases. Never rename and
change construction in the same commit.

**Special care:**
- **Same store instance** — after moving a store, verify every import resolves
  to one instance; two instances split state silently (tests pass, app breaks).
- **`persist` keys** unchanged (§5).
- **`AttributeScanner` dynamic imports** — update the `import('…')` path for any
  moved feature folder, or that feature never instantiates.

---

## 10. Forbidden

- Do not change `index.ts`'s exports, or the `data-next-*` / event contract,
  without explicit approval (§0.1).
- Do not mix a folder rename and a construction/behavior change in one step (§0.2).
- Do not import across features or upward across the dependency direction (§2).
- Do not let a feature construct its own singletons — inject via `client.ts` (§6).
- Do not add an interface for a class with a single, un-mocked, un-swapped
  dependent (§6).
- Do not ship `debug/` in the production entry.
- Do not duplicate content across rule/skill files — cross-link instead.
