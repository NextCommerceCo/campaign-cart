# Campaign SDK

One headless Engine owns all campaign state; DOM bindings, analytics and debug subscribe to
it. Read `docs/architecture/design.md`, `engine.md` and `structure.md` before changing
structure.

## Commands

`npm test` · `npm run typecheck` · `npm run build` (fails over a gzip budget) · `npm run format` ·
`bun dev` (campaign pages with the SDK from source and a mock API; never run `--live` for the
user: it calls the live Campaigns API)

## Rules

- `src/engine/` is the headless layer: no browser globals, and the only code that calls the
  API or storage. Every other folder is a chunk (`bindings/` core, `checkout/`, `order/`
  lazy). Two levels at most under `src/`. No `managers/`, `services/`, `utils/` folders.
- Imports go one way; `tests/architecture.test.ts` enforces the table in `structure.md`.
- Every state change goes through an Engine action and `update()`. Bindings never call the
  network.
- Named exports only; `index.ts` only as a chunk entry.
- Code over comments; explanations go in `docs/`. 0.4.x compatibility lives only in each
  chunk's `legacy.ts` (and the `legacy*` readers in `config.ts`), each `@deprecated`.
- Tests mirror `src/` under `tests/`; `tests/engine/**` runs in Node. Every bug fix adds a test
  that fails without it.
- `dist/` is built by CI and never committed.
