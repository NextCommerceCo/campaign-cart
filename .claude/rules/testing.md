# Testing Conventions

## Stack
- **Unit tests**: Vitest + happy-dom (`npm run test`)
- **E2E tests**: Playwright (`npm run test:e2e`) — Chromium, Firefox, WebKit, Pixel 5
- **Coverage target**: 80% branches / functions / lines / statements

## Unit Tests
- **Feature tests are colocated** with their code — `src/features/<cat>/<feature>/tests/*.test.ts`, one `<source>.test.ts` per source file. They move with the feature. (See the `sdk-structure` skill.)
- **Core tests** live in `src/core/tests/*.test.ts` — same `<source>.test.ts` naming
  (`currency-formatter.ts` → `currency-formatter.test.ts`).
- **State/store tests** live alongside their store in `src/state/<domain>/`.
- `src/tests/**/*.test.ts` is for **cross-cutting / integration** tests only:
  - `src/tests/analytics/` — analytics validators, event builders, provider adapters. Cross-cutting because one event is produced by several features and consumed by several providers.
  - `src/tests/contract/` — the gates: public export surface, dynamic-import resolution, store identity + `persist` keys, production-bundle contents. These fail on a whole-repo invariant, not on one unit.
  - `src/tests/docs/` — documentation drift checks: every generated page must still match the source it was generated from.
  - Do NOT unit-test per-feature code here; that belongs colocated with the feature.
- Setup file: `src/tests/setup.ts` (DOM reset, window cleanup runs before each test) — the path `vitest.config.ts` actually registers in `setupFiles`
- Import from `vitest` — not `jest`: `import { describe, it, expect, vi } from 'vitest'`
- Use `vi.fn()` for mocks, `vi.spyOn()` for spies
- Test pure utils and store logic; enhancer DOM tests belong in E2E

## What to Test
- Pure utility functions in `src/utils/` — always unit test these
- Store actions and state transitions — test with real Zustand store instances
- Type guard functions (`src/utils/typeGuards.ts`) — test all branches
- Display formatting / currency formatting — unit test edge cases

## What NOT to Unit Test
- Enhancer DOM wiring — covered by E2E
- API client (`src/api/client.ts`) — mock at the fetch level, not the class level
- EventBus emit/on round-trips — integration-test territory

## Mocking
- Mock `fetch` via `vi.stubGlobal('fetch', vi.fn())` in setup or per-test
- Don't mock Zustand stores — test with real store instances and reset state between tests
- Reset stores between tests using the store's reset action or `store.setState(initialState)`
