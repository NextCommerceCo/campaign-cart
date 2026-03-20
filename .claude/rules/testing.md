# Testing Conventions

## Stack
- **Unit tests**: Vitest + happy-dom (`npm run test`)
- **E2E tests**: Playwright (`npm run test:e2e`) — Chromium, Firefox, WebKit, Pixel 5
- **Coverage target**: 80% branches / functions / lines / statements

## Unit Tests
- Test files: `src/tests/**/*.test.ts`
- Setup file: `src/test/setup.ts` (DOM reset, window cleanup runs before each test)
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
