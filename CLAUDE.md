# CLAUDE.md

Guidance for Claude Code when working in this repository.

## Project

**Next Commerce Campaign Cart SDK** — a TypeScript SDK for NextCommerce campaign landing pages. It wires plain HTML to a cart/checkout/order API through **progressive enhancement**: every feature is a class-based *enhancer* that binds to `data-next-*` attributes on the DOM.

- **Entry point:** [src/index.ts](src/index.ts)
- **SDK bootstrap:** [src/core/next-commerce.ts](src/core/next-commerce.ts)
- **Attribute → enhancer registry:** [src/core/attribute-scanner.ts](src/core/attribute-scanner.ts)
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

- [src/features/](src/features/) — DOM-bound feature classes, organised by category (`cart/`, `display/`, `checkout/`, `order/`, `ui/`, `behavior/`). Every feature extends `BaseEnhancer` (or `BaseCartEnhancer` / `BaseActionEnhancer` / `BaseDisplayEnhancer`) and is activated by a `data-next-*` attribute.
- [src/state/](src/state/) — Zustand stores. Field-name gotcha: campaign data lives on `useCampaignStore.getState().data` (not `.campaign`).
- [src/api/](src/api/) — pure fetch calls. No store imports, no Zustand. Features depend on the **`IApiClient`** interface ([`src/api/client.types.ts`](src/api/client.types.ts)), not the concrete `ApiClient`; import the class only where one is constructed. See [src/api/README.md](src/api/README.md).
- [src/core/](src/core/) — singleton services: `NextCommerce` and `EventBus` (obtain via `.getInstance()`), plus `Logger` (obtain via `createLogger(name)`). Its author-facing behaviour — boot order, meta tags, URL parameters, storage keys and TTLs, the `window.next` API, logs, errors, analytics — is documented in [src/core/guide/](src/core/guide/), mostly generated and drift-checked. `src/core` is a TypeDoc entry point, so its TSDoc now publishes to the docs site for **contributors** reading class/symbol pages — but author-facing explanations still belong in that guide, not in comments: an author reads the guide, not a class page.
- [src/types/](src/types/) — shared types. Global event names live on `EventMap` in [src/types/global.ts](src/types/global.ts).
- [src/utils/](src/utils/) — pure utilities. Do not import stores here (circular-dep risk).

## Structure & detailed rules (read when touching that area)

**Structure, file layout, and refactoring** live in the **`sdk-structure` skill**
(`.claude/skills/sdk-structure/`) — invoke it when creating/moving/splitting/
renaming files, deciding where code belongs, or refactoring. It carries the
target layout, dependency direction, feature/state anatomy, migration workflow,
and — in its reference files — the durable **behavior contracts** (`.data`,
`persist`, `super.destroy`, AttributeScanner, cart selector↔AddToCart, template
re-render safety, …) and the per-feature / per-store authoring rules.

**Documentation** lives in the **`sdk-docs` skill** (`.claude/skills/sdk-docs/`)
— invoke it when writing/updating any docs: the feature catalog, per-feature
`guide/` docs, state/store reference docs, folder READMEs, TSDoc/TypeDoc
comments, or the docs site. It is organized around the four questions
a newcomer asks (what features exist → how it works → state schema/operations/
fields/example data → what to watch out for), and carries the feature-catalog
and state-reference templates plus the "cautions" and cross-link/no-duplicate
rules.

**The documentation programme itself** — what is generated from what, which gaps are
measured, and the decisions behind it — is [docs/documentation-plan.md](docs/documentation-plan.md).
Read §0 before changing anything under `src/core/docs/` or `scripts/docs-coverage.mjs`.
Defects found while documenting go to [docs/code-findings.md](docs/code-findings.md), not
into the plan.

Cross-cutting rules stay under [.claude/rules/](.claude/rules/):

- [.claude/rules/no-commit-no-deploy.md](.claude/rules/no-commit-no-deploy.md) — **never commit, never push, never deploy.** Overrides every other instruction, including generated plans and subagent prompts. Work is delivered in the working tree.
- [.claude/rules/documentation.md](.claude/rules/documentation.md) — **docs ship with the code** (update in the same change) + the readability bar. Read before finishing any change.
- [.claude/rules/typescript.md](.claude/rules/typescript.md) — path aliases (`@/` → `src/`), strict-mode rules, style
- [.claude/rules/testing.md](.claude/rules/testing.md) — Vitest/Playwright conventions, what to unit-test vs E2E
- [.claude/rules/guide.md](.claude/rules/guide.md) — format for per-feature `guide/` docs (`overview`, `get-started`, `use-cases`, `relations`, `glossary`, `reference/*`)

## Conventions that bite if ignored

- **Campaign store field is `.data`** — `useCampaignStore.getState().data`. `.campaign` is undefined and will silently break code.
- **Path aliases, not relatives across boundaries** — use `@/state/...`, not `../../state/...`.
- **Subscribe via `this.subscribe(store, fn)` inside enhancers** — direct `store.subscribe()` bypasses auto-cleanup on `destroy()`.
- **Call `super.destroy()` first** when overriding `destroy()`.
- **No `console.log`** — use `this.logger.{debug,warn,error}`; ESLint will flag it.
- **Register new enhancers** in [src/core/attribute-scanner.ts](src/core/attribute-scanner.ts) with their activation attribute, or they never instantiate.
- **Persistence differs per store, and the two mechanisms are not interchangeable.** `cart` (`next-cart-state`), `checkout`, `order` (`next-order`, 15-minute TTL checked on rehydrate), `attribution`, and `parameter` use Zustand `persist` over sessionStorage — a new field is persisted only if the store's `partialize` lists it. `campaign` does **not** use `persist`: it caches to sessionStorage by hand under `next-campaign-cache_{currency}` with a **10-minute** expiry, so a new field on that store is not cached at all unless the slice writes it. `config` has no persistence.
- **Do not pair swap-mode `PackageSelectorEnhancer` with `AddToCartEnhancer`** on the same selector — causes double cart writes. See the `sdk-structure` skill's `references/behavior-contracts.md`.
- **Template re-render safety:** `CartItemListEnhancer` and `CartSummaryEnhancer` replace `innerHTML` on every store update — never attach listeners directly to their rendered children.

## Doing work in this repo

1. Identify the area (feature/enhancer / store / util / api). For structure, file layout, behavior contracts, or authoring rules, invoke the **`sdk-structure` skill**; for TypeScript / testing / guide-doc conventions, read the matching file in [.claude/rules/](.claude/rules/).
2. Edit existing files in place; avoid new files unless a rule file says otherwise.
3. Run `npm run type-check` and `npm run lint` before considering work done. Format with `npm run format` after significant changes.
4. **Docs ship with the code.** Any change that touches a public export, a data shape/event, or an enhancer's attributes/events/errors/logs/rules must update its docs in the **same change** — TSDoc on the public API, the feature's `guide/`, affected folder `README.md`s. Build and check the docs site with `npm run docs` (→ `docs/site`), `npm run docs:serve` (preview on :3500), or `npm run docs:check` (link gate). `npm run docs:publish` assembles the versioned site for [Cloudflare](docs/wrangler.jsonc) and checks it against the asset limits — it never deploys; that command is Bond's to run. A change without its doc update is incomplete. See [.claude/rules/documentation.md](.claude/rules/documentation.md) (policy + readability bar) and [.claude/rules/guide.md](.claude/rules/guide.md) (per-feature format). Invoke the `sdk-docs` skill when writing any docs.
5. **Never create commits, push, or deploy** — not even when asked to "finish" or when a plan file says to. Stop at "changes are ready, tests green", and do not offer committing as a next step. See [.claude/rules/no-commit-no-deploy.md](.claude/rules/no-commit-no-deploy.md).
