# CLAUDE.md

Guidance for Claude Code when working in this repository.

## Project

**Next Commerce Campaign Cart SDK** — a TypeScript SDK for NextCommerce campaign landing pages. It wires plain HTML to a cart/checkout/order API through **progressive enhancement**: every feature is a class-based *enhancer* that binds to `data-next-*` attributes on the DOM.

- **Entry point:** [src/index.ts](src/index.ts)
- **SDK bootstrap:** [src/core/NextCommerce.ts](src/core/NextCommerce.ts)
- **Attribute → enhancer registry:** [src/enhancers/core/AttributeScanner.ts](src/enhancers/core/AttributeScanner.ts)
- **Output:** ESM + UMD bundle (`dist/`) loaded on customer pages via a small loader script
- **Stack:** TypeScript (strict), Zustand, Vite, Vitest, Playwright

## Commands

| Task | Command |
|---|---|
| Dev server | `npm run dev` |
| Build | `npm run build` |
| Type check (run before declaring work done) | `npm run type-check` |
| Lint | `npm run lint` / `npm run lint:fix` |
| Format | `npm run format` |
| Unit tests | `npm run test` |
| E2E tests | `npm run test:e2e` |
| Coverage | `npm run test:coverage` |

## Architecture at a glance

- [src/enhancers/](src/enhancers/) — DOM-bound feature classes, organised by category (`cart/`, `display/`, `checkout/`, `order/`, `ui/`, `behavior/`, `profile/`, `core/`). Every feature extends `BaseEnhancer` (or `BaseCartEnhancer` / `BaseActionEnhancer` / `BaseDisplayEnhancer`) and is activated by a `data-next-*` attribute.
- [src/stores/](src/stores/) — Zustand stores. Field-name gotcha: campaign data lives on `useCampaignStore.getState().data` (not `.campaign`).
- [src/api/](src/api/) — pure fetch/axios calls. No store imports, no Zustand.
- [src/core/](src/core/) — singleton services: `NextCommerce`, `EventBus`, `Logger`. Always obtain via `.getInstance()`.
- [src/types/](src/types/) — shared types. Global event names live on `EventMap` in [src/types/global.ts](src/types/global.ts).
- [src/utils/](src/utils/) — pure utilities. Do not import stores here (circular-dep risk).

## Detailed rules (read when touching that area)

Project rules are split by concern under [.claude/rules/](.claude/rules/). Consult the relevant file **before** writing code in that area:

- [.claude/rules/architecture.md](.claude/rules/architecture.md) — enhancer pattern, store access, EventBus, file layout
- [.claude/rules/enhancers.md](.claude/rules/enhancers.md) — creating/modifying enhancers, file structure, lifecycle, `data-next-*` conventions
- [.claude/rules/cart-enhancers.md](.claude/rules/cart-enhancers.md) — selector↔AddToCart contract, swap vs select, bundle rules, template re-render safety
- [.claude/rules/stores.md](.claude/rules/stores.md) — store list, access patterns, persistence, `.data` vs `.campaign`
- [.claude/rules/zustand.md](.claude/rules/zustand.md) — slice file layout, middleware order, selector patterns
- [.claude/rules/typescript.md](.claude/rules/typescript.md) — path aliases (`@/` → `src/`), strict-mode rules, style
- [.claude/rules/testing.md](.claude/rules/testing.md) — Vitest/Playwright conventions, what to unit-test vs E2E
- [.claude/rules/guide.md](.claude/rules/guide.md) — format for per-enhancer `guide/` docs (`overview`, `get-started`, `use-cases`, `relations`, `glossary`, `reference/*`)

## Conventions that bite if ignored

- **Campaign store field is `.data`** — `useCampaignStore.getState().data`. `.campaign` is undefined and will silently break code.
- **Path aliases, not relatives across boundaries** — use `@/stores/...`, not `../../stores/...`.
- **Subscribe via `this.subscribe(store, fn)` inside enhancers** — direct `store.subscribe()` bypasses auto-cleanup on `destroy()`.
- **Call `super.destroy()` first** when overriding `destroy()`.
- **No `console.log`** — use `this.logger.{debug,warn,error}`; ESLint will flag it.
- **Register new enhancers** in [src/enhancers/core/AttributeScanner.ts](src/enhancers/core/AttributeScanner.ts) with their activation attribute, or they never instantiate.
- **Cart/campaign stores use `persist`** (sessionStorage); `orderStore` has a 15-minute TTL. New fields inherit the persistence/TTL behaviour.
- **Do not pair swap-mode `PackageSelectorEnhancer` with `AddToCartEnhancer`** on the same selector — causes double cart writes. See [.claude/rules/cart-enhancers.md](.claude/rules/cart-enhancers.md).
- **Template re-render safety:** `CartItemListEnhancer` and `CartSummaryEnhancer` replace `innerHTML` on every store update — never attach listeners directly to their rendered children.

## Doing work in this repo

1. Identify the area (enhancer / store / util / api) and read the matching rule file in [.claude/rules/](.claude/rules/).
2. Edit existing files in place; avoid new files unless a rule file says otherwise.
3. Run `npm run type-check` and `npm run lint` before considering work done. Format with `npm run format` after significant changes.
4. If you change an enhancer's attributes, events, errors, or business rules, update its `guide/` docs in the same change — see [.claude/rules/guide.md](.claude/rules/guide.md).
5. Do **not** create commits or push unless the user explicitly asks.
