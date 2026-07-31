# core/

**The engine** — the machinery that runs the SDK. The *classes* here are internal and
free to move; consumers only ever import `src/index.ts`. The *behaviour* is a different
matter, and conflating the two is a mistake worth avoiding: core is where the boot
sequence, the API-key meta tag, the storage keys and their expiry, `?debug=true`, the
`window.next` surface, error capture, attribution, and all analytics live. A page author
never imports `SDKInitializer` and depends entirely on what it does.

> **Reader-facing documentation for that behaviour is in [`guide/`](./guide/)**, mostly
> generated from this source and drift-checked. Start at
> [`guide/overview.md`](./guide/overview.md) for the map of subsystems; the contracts —
> boot order, storage keys and TTLs, meta tags, URL parameters, logs, errors, the
> analytics catalogue, and the `window.next` API — are under
> [`guide/reference/`](./guide/reference/). The inventory that ties them together is
> [`docs/core-subsystems.ts`](./docs/core-subsystems.ts), and
> `npm run docs:coverage` measures it.

## Contents

| Path | What it is |
|------|------------|
| `attribute-scanner.ts` | Discovers `data-next-*` elements and instantiates the bound feature (dynamic `import()` per feature) |
| `sdk-initializer.ts` | Boot sequence — config, location/currency, campaign load, analytics, DOM scan |
| `next-commerce.ts` | The programmatic SDK facade (`NextCommerce` / `sdk.*`, incl. `sdk.cart.*`) |
| `base/` | Base feature classes (`base-enhancer`, `base-cart-enhancer`, `base-action-enhancer`) + `attribute-parser`, `dom-observer` |
| `analytics/` | Analytics subsystem (providers, events, tracking) — a lazy `analytics` chunk, not a feature |
| `debug/` | Dev-only debug overlay/panels — loaded via dynamic `import()` so it never ships in the production bundle |
| `attribution/` | Attribution capture run at SDK init: `attribution-collector` (reads UTM/referrer/funnel into `attribution.state`) and `utm-transfer` (propagates URL params to page links) |
| `monitoring/` | `error-handler` — central runtime error capture, emits on the event bus |
| `logger.ts` | `Logger` / `createLogger` — leveled logging used across every layer |
| `events.ts` | `EventBus` — the type-safe SDK event bus (`EventMap`) |
| `storage.ts` | `StorageManager` / `sessionStorageManager` — persistence helper backing the stores' `persist` |
| `country-service.ts` | Loads and caches country/state geographic data for checkout, debug, and init |
| `test-mode.ts` | Detects and manages SDK test mode |
| `docs/` | Build-time documentation machinery — the feature/state/core manifests and the renderers that generate the guides. Never imported at runtime |

## Dependency direction

`core/` depends on **nothing above it** — never imports `features/`. It may use
`state/`, `types/`, `utils/`. Features depend on core, not the reverse.

## Pending redesign (skill §6)

The engine still uses `.getInstance()` singletons. The target is a `client.ts`
composition root that creates dependencies (`http` + `IHttpClient`, events,
state) once and injects them into features. That is a deliberate separate phase,
not a folder move — see the `sdk-structure` skill.

## Docs

**Core is a published TypeDoc entry point.** `typedoc.json` lists `src/core` (alongside
`src/index.ts` and `src/state`) as an entry point with `entryPointStrategy: "expand"`, so
every exported class, function, and type here — `AttributeScanner`, `SDKInitializer`,
`EventBus`, `Logger`, and the rest — gets its own page in the generated site, for
**contributors** browsing or extending the SDK.

This corrects what this file used to say: it claimed core was kept out of the reference
because it is "marked `@internal` (`excludeInternal: true`)". That was already wrong even
before core became an entry point — an AST scan found core was excluded by two other
things: `src/index.ts` being the *only* entry point (re-exporting four core symbols only,
leaving the rest unreachable) and a Fumadocs build step that deleted class pages outright.
Neither applies now that core is directly reachable.

`excludeInternal: true` is still the project's TypeDoc setting, and the `@internal` tag
still means what it always meant — "hide this page from the generated site" — but the tag
only does anything when it sits directly on an exported declaration (a class, function,
exported const, etc.). A comment block in `docs/` that documents a *file* rather than a
declaration is not attached to anything TypeDoc reads, so tagging it `@internal` is a
no-op either way. If you are adding one to genuinely hide a member, tag the declaration
itself and confirm it disappears from a local `npm run docs` build — don't assume the tag
worked from reading the source.

The distinction that still matters when deciding where to put an explanation: **TSDoc
inside `src/core/**` is now reader-visible, but only to contributors reading the reference
pages** — it documents *how the code is built*, for the next maintainer. It is not where a
page author looks. Anything a page author needs — boot order, meta tags, storage keys and
TTLs, URL parameters, the `window.next` API, logs, errors — stays in
[`guide/`](./guide/), which is hand-written (mostly generated from this source) for
exactly that audience. Publishing core does not merge these two docs; it gives the
contributor-facing one a home.

Orientation for contributors lives in this README and the `sdk-structure` skill.
