# Testing Conventions

> This file owns the **unit** side. Everything under `e2e/` — when a Playwright
> spec is required, and what makes one count — is [e2e.md](./e2e.md), with the
> how-to in the **`sdk-e2e` skill** (`.claude/skills/sdk-e2e/`). Invoke that skill
> whenever you touch `e2e/`.

## Stack
- **Unit tests**: Vitest + happy-dom (`npm run test`)
- **E2E tests**: Playwright (`npm run test:e2e`) — Chromium, Firefox, WebKit, Pixel 5, iPhone 12. **Not run by CI** — see [e2e.md](./e2e.md) §5.
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
  - `src/tests/display/` — the display **system**: `DisplayFormatter` in `core/base/` exercised
    through real enhancers from two different feature categories (`features/display/*` and
    `features/cart/cart-summary`). Cross-cutting because the formatter is shared base-layer
    code and the point of the test is that it behaves the same whichever feature drives it —
    colocating it under one of those features would hide that.
  - Do NOT unit-test per-feature code here; that belongs colocated with the feature.
- Setup file: `src/tests/setup.ts` (DOM reset, window cleanup runs before each test) — the path `vitest.config.ts` actually registers in `setupFiles`
- Import from `vitest` — not `jest`: `import { describe, it, expect, vi } from 'vitest'`
- Use `vi.fn()` for mocks, `vi.spyOn()` for spies
- Test pure utils and store logic; enhancer DOM tests belong in E2E

## Type-checking test files

`npm run type-check` (`tsconfig.json`) excludes `**/*.test.ts` and `**/*.spec.ts` —
tests are not part of the shipped build, so that gate never sees them. A test
double typed as `Pick<IApiClient, …>` or similar only catches drift if
something actually compiles it.

`npm run type-check:tests` runs the wider program instead
(`tsconfig.eslint.json` — same options, plus `e2e/`, `scripts/`, and the two
build configs). It is a **ratchet**, same shape as `docs:coverage` /
`docs-coverage.baseline.json`: pre-existing errors are frozen in
`scripts/type-check-tests.baseline.json` and tolerated; a genuinely new error —
in a new place, or a new *kind* of error in an already-frozen file — fails the
run. Fixing an error and leaving the file otherwise alone shrinks the baseline
(`npm run type-check:tests:update`); introducing a new error, even in a file
that already has frozen ones, fails regardless of the total count. Do not
"fix" a frozen error by editing the test's assertions/fixtures to make the
compiler happy — if the type mismatch is real, it stays frozen until someone
fixes the underlying code or fixture on purpose. See the header comment in
`scripts/type-check-tests.mjs` for why fingerprints never cite a line number.

## What to Test
- Pure utility functions in `src/utils/` — always unit test these
- Store actions and state transitions — test with real Zustand store instances
- Type guard / validation-predicate functions — test all branches, wherever they
  live. There is no dedicated `src/utils/typeGuards.ts` module anymore: it had
  zero callers across `src/`, `e2e/`, `scripts/` and `examples/` and was removed
  as dead code. Validation like this is currently written ad hoc per call site
  (e.g. `!isNaN(qty)` / `Number.isFinite(...)` in `src/features/cart/**` and
  `src/features/display/**`) — if you factor a guard back out, it still belongs
  in `src/utils/` and still needs this same branch coverage.
- Display formatting / currency formatting — unit test edge cases

## What NOT to Unit Test
- Enhancer DOM wiring — covered by E2E ([e2e.md](./e2e.md) §1 makes that a requirement, not just a preference)
- API client (`src/api/client.ts`) — mock at the fetch level, not the class level
- EventBus emit/on round-trips — integration-test territory

## Driving animation frames and timers

A module that nests `requestAnimationFrame` needs it stubbed to run synchronously, or the
callbacks never execute and assertions see the pre-animation state:

```ts
vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback): number => {
  cb(0);
  return 0;
});
```

**`vi.useFakeTimers()` also fakes `requestAnimationFrame`** — it exists on `global` under
happy-dom, so the fake-timer library takes it over and silently replaces the stub above
with one that needs manual frame ticking. Any test that needs both fake timers *and*
synchronous frames must re-apply the stub **after** `vi.useFakeTimers()`. Symptom when you
forget: the element is stuck at its starting state with no error.

Restore with `vi.unstubAllGlobals()` and `vi.useRealTimers()` in `afterEach`.
Worked example: `src/features/checkout/checkout-form/tests/billing-animation.test.ts`.

**happy-dom does no layout**, so `scrollHeight` / `offsetHeight` / `getBoundingClientRect()`
are all zero. Assert the properties and classes the code *sets*, never computed geometry —
a test that needs real pixel heights belongs in E2E.

## Mocking
- Mock `fetch` via `vi.stubGlobal('fetch', vi.fn())` in setup or per-test
- Don't mock Zustand stores — test with real store instances and reset state between tests
- Reset stores between tests using the store's reset action or `store.setState(initialState)`
