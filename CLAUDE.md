# Campaign SDK

One headless Engine owns all campaign state; DOM bindings, analytics and debug subscribe to
it. Read `docs/architecture/design.md`, `engine.md` and `structure.md` before changing
structure.

## Commands

`npm test` · `npm run typecheck` · `npm run build` (fails over a gzip budget) · `npm run format` ·
`bun dev` (campaign pages with the SDK and a mock API) · `bun run e2e`. Never run
`--api live|full` or `bun run qa` without `--no-tunnel` for the user: they reach the live API or
publish a public link

## Rules

- Folders are features: everything about one thing sits together (`checkout/address/`).
  Every top-level folder except `engine/` and `compat/` is a chunk (`bindings/` boot,
  `checkout/`, `order/`, `analytics/` lazy). Three levels at most under `src/`. No `managers/`,
  `services/`, `utils/` folders.
- Headless code is `src/engine/` and each feature's `state` (`checkout/state/`,
  `order/state.ts`): no browser globals, and the only code that calls the API or storage.
- Imports go one way; `tests/architecture.test.ts` enforces the table in `structure.md`.
- Every state change goes through an Engine action and `update()`. Bindings never call the
  network.
- Named exports only; `index.ts` only as a chunk entry.
- `src/` root holds `loader.ts`, `boot.ts`, `config.ts` and the one-file `debug.ts` chunk;
  every other feature lives in a folder.
- Code over comments; explanations go in `docs/`. 0.4.x compatibility lives only in `src/compat/`,
  one file per chunk that uses it, each `@deprecated`.
- Tests mirror `src/` under `tests/`; headless tests (`tests/engine/**`, `tests/*/state*`) run in
  Node. Every bug fix adds a test that fails without it.
- Log through `engine.log` (`src/engine/log.ts`); only it and `loader.ts`, which runs before an
  Engine exists, touch `console`. Log data never carries payment details.
- `dist/` is built by CI and never committed.
