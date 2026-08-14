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
- [src/core/](src/core/) — singleton services: `NextCommerce` and `EventBus` (obtain via `.getInstance()`), plus `Logger` (obtain via `createLogger(name)`). Its author-facing behaviour — boot order, meta tags, URL parameters, storage keys and TTLs, the `window.next` API, logs, errors, analytics — is documented in [src/core/guide/](src/core/guide/), mostly generated and drift-checked. `src/core` is **not** a TypeDoc entry point, so none of its TSDoc reaches the docs site — write it for the next contributor reading the source, and put author-facing explanation in a published guide instead.
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

**End-to-end tests** live in the **`sdk-e2e` skill** (`.claude/skills/sdk-e2e/`) —
invoke it when adding or changing anything under `e2e/`, when a change touches what
renders in the browser, or when deciding whether a behaviour belongs in Vitest or
Playwright. It carries the fixture/stub harness API, the fixture→published-example
contract, and the "prove it can fail" discipline. Its policy half — when a spec is
*required* — is [.claude/rules/e2e.md](.claude/rules/e2e.md).

**Documentation** lives in the **`sdk-docs` skill** (`.claude/skills/sdk-docs/`)
— invoke it when writing/updating any docs: the feature catalog, per-feature
`guide/` docs, state/store reference docs, folder READMEs, TSDoc/TypeDoc
comments, or the docs site. It is organized around the four questions
a newcomer asks (what features exist → how it works → state schema/operations/
fields/example data → what to watch out for), and carries the feature-catalog
and state-reference templates plus the "cautions" and cross-link/no-duplicate
rules.

**What the docs site publishes.** The site is deliberately small: the hand-written
guides under [docs/guides/](docs/guides/) (Start Here, Building Pages, Reference)
plus the public API surface generated from `src/index.ts`. `typedoc.json` lists
exactly that — `projectDocuments` names the `docs/guides/` globs and `entryPoints`
is `src/index.ts` alone.

Everything else under `src/**/guide/` stays **on disk and unpublished**. Those
trees were largely machine-written, were never readable end to end, and are hidden
until a human rewrites them. They are still real source: `scripts/docs-coverage.mjs`
measures them and `src/tests/docs/` drift-checks the generated ones, so keep them
accurate — a coverage gap or a drift failure is still a failure. Publishing one
back means rewriting it first, then adding its glob to `projectDocuments`.

So there are three places a doc can live, and only the first two reach a reader
today: a `docs/guides/` page (published, hand-written, for page authors), TSDoc on
a `src/index.ts` export (published, for integrators), or a `src/**/guide/` page
(unpublished, accurate, awaiting a rewrite). Write author-facing explanation in a
guide, never in a class comment.

**The documentation programme itself** — what is generated from what, and which gaps
are measured — now lives in the code rather than a plan document:
[src/docs/](src/docs/) holds the extractors (`extract/`), the hand-written content
(`content/`) and the renderers (`render/`); `scripts/docs-coverage.mjs` holds the
measured gaps and their frozen baseline; and `src/tests/docs/` fails when a generated
page drifts from its source. `docs/documentation-plan.md` used to carry the narrative
and was deleted in `23f2562` — read the extractor and its drift test instead.
Defects found while documenting go to [docs/code-findings.md](docs/code-findings.md).

Cross-cutting rules stay under [.claude/rules/](.claude/rules/):

- [.claude/rules/docs-layout.md](.claude/rules/docs-layout.md) — **how a doc page is structured so it can be read**: two-column tables headed `Description`, value lists as tables not sentences, one heading level per depth, an `Example` for every attribute with a lead-in sentence, prettier-formatted HTML at 80 columns, descriptions sourced from manifests. Read this first when writing or restructuring any published page.
- [.claude/rules/documentation.md](.claude/rules/documentation.md) — **docs ship with the code** (update in the same change) + the readability bar. Read before finishing any change.
- [.claude/rules/docs-fact-check.md](.claude/rules/docs-fact-check.md) — **mandatory re-checks before any docs change ships** (apollo-only examples, no `os-*`, behavior claims need SDK source citations, trace example property chains, check open bugs, analytics "auto" needs a traced caller). Born from the PR #82 review.
- [.claude/rules/typescript.md](.claude/rules/typescript.md) — path aliases (`@/` → `src/`), strict-mode rules, style
- [.claude/rules/testing.md](.claude/rules/testing.md) — Vitest conventions, what to unit-test vs E2E
- [.claude/rules/e2e.md](.claude/rules/e2e.md) — **when a Playwright spec is required**, the fixture→docs contract, and the fact that CI does not run E2E
- [.claude/rules/guide.md](.claude/rules/guide.md) — format for per-feature `guide/` docs (`overview`, `get-started`, `use-cases`, `relations`, `glossary`, `reference/*`)

## Conventions that bite if ignored

- **Campaign store field is `.data`** — `useCampaignStore.getState().data`. `.campaign` is undefined and will silently break code.
- **Path aliases, not relatives across boundaries** — use `@/state/...`, not `../../state/...`.
- **Subscribe via `this.subscribe(store, fn)` and listen via `this.on(event, fn)` inside enhancers** — both record an unsubscribe that `destroy()` runs. Calling `store.subscribe()` or `this.eventBus.on()` directly bypasses that cleanup, and because `EventBus` is a page-lifetime singleton, a bus handler left behind keeps firing on a destroyed enhancer. `EventBus.on()` returns an unsubscribe function — use it (or `this.on`) rather than stashing a bound reference for `EventBus.off()`.
- **Call `super.destroy()` first** when overriding `destroy()`.
- **No `console.log`** — use `this.logger.{debug,warn,error}`; ESLint will flag it.
- **Register new enhancers** in [src/core/attribute-scanner.ts](src/core/attribute-scanner.ts) with their activation attribute, or they never instantiate.
- **Persistence differs per store, and the two mechanisms are not interchangeable.** `cart` (`next-cart-state`), `checkout`, `order` (`next-order`, 15-minute TTL checked on rehydrate), `attribution`, and `parameter` use Zustand `persist` over sessionStorage — a new field is persisted only if the store's `partialize` lists it. `campaign` does **not** use `persist`: it caches to sessionStorage by hand under `next-campaign-cache_{currency}` with a **10-minute** expiry, so a new field on that store is not cached at all unless the slice writes it. `config` has no persistence.
- **Do not pair swap-mode `PackageSelectorEnhancer` with `AddToCartEnhancer`** on the same selector — causes double cart writes. See the `sdk-structure` skill's `references/behavior-contracts.md`.
- **Template re-render safety:** `CartItemListEnhancer` and `CartSummaryEnhancer` replace `innerHTML` on every store update — never attach listeners directly to their rendered children.

## Doing work in this repo

1. Identify the area (feature/enhancer / store / util / api). For structure, file layout, behavior contracts, or authoring rules, invoke the **`sdk-structure` skill**; for TypeScript / testing / guide-doc conventions, read the matching file in [.claude/rules/](.claude/rules/).
2. Edit existing files in place; avoid new files unless a rule file says otherwise.
3. Run `npm run type-check` and `npm run lint` before considering work done. Format with `npm run format` after significant changes. If the change is browser-facing, run `npm run test:e2e` too — **CI does not run Playwright**, so nothing else will catch it ([.claude/rules/e2e.md](.claude/rules/e2e.md) §5).
4. **Docs ship with the code.** Any change that touches a public export, a data shape/event, or an enhancer's attributes/events/errors/logs/rules must update its docs in the **same change** — TSDoc on the public API, the feature's `guide/`, affected folder `README.md`s. Build and check the docs site with `npm run docs` (→ `docs/site`), `npm run docs:serve` (preview on :3500), or `npm run docs:check` (link gate). `npm run docs:publish` assembles the versioned site for [Cloudflare](docs/wrangler.jsonc) and checks it against the asset limits — it never deploys. Deploying belongs to CI ([.github/workflows/docs-deploy.yml](.github/workflows/docs-deploy.yml)): a push to `main` refreshes the `main/` folder, a `v*.*.*` tag push publishes that release, and manual dispatch covers a re-publish. Never run the deploy yourself. It publishes one folder per released tag, `latest/` for the newest, and `main/` for the unreleased branch tip (`npm run docs:main` builds that folder alone; it is not a version and is never indexed — see [.claude/rules/documentation.md](.claude/rules/documentation.md)). A change without its doc update is incomplete. See [.claude/rules/documentation.md](.claude/rules/documentation.md) (policy + readability bar) and [.claude/rules/guide.md](.claude/rules/guide.md) (per-feature format). Invoke the `sdk-docs` skill when writing any docs.
5. **Never push, never deploy.** Committing locally is fine — a short commit message naming the work. But no `git push`, no PR, no `wrangler`/`npm publish`/CI trigger, not even a "preview" deploy, and not when a plan file says to. Stop at "committed locally, tests green". The `permissions.deny` list in [.claude/settings.json](.claude/settings.json) enforces it at the tool layer; if you add a deploy target, add it there too.
