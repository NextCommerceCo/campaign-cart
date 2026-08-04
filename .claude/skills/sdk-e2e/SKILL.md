---
name: sdk-e2e
description: >-
  End-to-end testing methodology for the Campaign Cart SDK — how to write a
  Playwright spec that proves a shopper-visible behaviour and cannot pass for the
  wrong reason. Load when adding or changing anything under e2e/, when a bug got
  past the unit suite, when a change touches what renders in the browser
  (enhancer DOM wiring, attributes, formatting, the debug overlay), or when
  deciding whether a behaviour belongs in Vitest or Playwright. Carries the
  fixture/stub harness API, the fixture→published-example contract that
  docs:coverage gates, the "prove it can fail" discipline, and the traps that have
  actually produced green-but-meaningless specs in this repo. Pairs with
  .claude/rules/e2e.md (policy) and .claude/rules/testing.md (unit conventions).
---

# SDK E2E

How to write a Playwright spec for this SDK that is worth the seconds it costs.

> **North star:** a unit test proves the *logic*; an E2E proves the **shopper sees
> it**. If your assertion would pass with the DOM disconnected, it is a unit test
> wearing a browser costume — move it to Vitest and save the runtime.

## 0. Does this belong in E2E at all?

| Question | Where it belongs |
|---|---|
| Does this function return the right value? | Vitest |
| Does this store transition correctly? | Vitest |
| Does the value reach the DOM through a real enhancer? | **E2E** |
| Does a real `navigator.*` / browser API feed it? | **E2E** |
| Does clicking this actually repaint? | **E2E** |
| Does it work in WebKit's ICU as well as Chromium's? | **E2E** |
| Is the published markup example still correct? | **E2E** (see §3) |

`.claude/rules/testing.md` owns the Vitest side. Two standing entries there point
here: *"enhancer DOM wiring — covered by E2E"* and *"a test that needs real pixel
heights belongs in E2E"* (happy-dom does no layout, so `scrollHeight`,
`offsetHeight` and `getBoundingClientRect()` are all zero under Vitest).

**Do not port a passing unit test into E2E for extra confidence.** The suite runs
five browser projects; every duplicated assertion is paid for five times, forever.

## 1. The harness — use it, do not rebuild it

Everything lives in [`e2e/fixtures/routes.ts`](../../../e2e/fixtures/routes.ts).
Full API in [`references/harness.md`](./references/harness.md). The shape of every
spec:

```ts
import { test, expect } from '@playwright/test';
import { stubAll, bootSdk } from './fixtures/routes';

const FIXTURE = '/e2e/fixtures/my-feature.html';

test.beforeEach(async ({ page }) => {
  await stubAll(page);
});

test('does the thing the shopper sees', async ({ page }) => {
  await bootSdk(page, FIXTURE);

  await expect(page.locator('#total')).toHaveText('$29.99');
});
```

Three rules that follow from how it is built:

- **The network is faked; the SDK is not.** `page.route` intercepts
  `campaigns.apps.29next.com`; the SDK itself is the real one Vite serves. A spec
  that mocks an SDK module is testing the mock.
- **Never let a spec reach the live backend.** No un-stubbed endpoint, ever — it
  makes the suite non-deterministic and depends on someone's test data.
- **`bootSdk` is the only correct wait.** It polls for `window.next.on`. A
  `waitForTimeout` instead is a flake with a delay fuse.

## 2. Async rendering: assert with locators, never with `textContent()`

Enhancers render after the store settles, so a one-shot read races them:

```ts
// ✗ reads once, usually before the enhancer has run
expect(await page.locator('#total').textContent()).toBe('$29.99');

// ✓ auto-retries until it matches or the timeout expires
await expect(page.locator('#total')).toHaveText('$29.99');
```

Same for counts and attributes — `toHaveCount`, `toHaveAttribute`, `toHaveClass`
all retry. For anything the harness cannot express, `expect.poll(...)`. There is
exactly one legitimate `waitForTimeout`: proving something **has not** happened,
and even then prefer asserting the stable end state.

## 3. The fixture is the published example — this is the surprising one

A fixture is not private test scaffolding. Wrapping part of it in a marker:

```html
<!-- docs:example Add a fixed package to the cart -->
<button data-next-action="add-to-cart" data-next-package-id="1">Buy</button>
<!-- /docs:example -->
```

lifts that markup into the feature's `guide/reference/tested-example.md` via
[`src/docs/extract/extract-fixture-example.ts`](../../../src/docs/extract/extract-fixture-example.ts),
and `npm run docs:coverage` gates it — *"markup features whose published example
is one Playwright runs"*, currently **100%**. The point is that a snippet nobody
runs is a snippet that rots.

Consequences:

- **Editing a marked region edits the docs.** Re-run `npm run docs:reference` and
  commit the regenerated page in the same change.
- **A new DOM-activated feature needs a fixture**, or the gate drops below 100%.
- **Markup inside the marker must be exemplary**, not minimal-to-pass: it is what
  an integrator copies. Real values, no placeholder cruft.
- **A fixture with no matching feature folder takes no marker.** Config-level specs
  (`locale.html`) are measured, not published — say so in an HTML comment so the
  next person does not "fix" the omission.

## 4. Prove the test can fail

**A new spec is not done until you have watched it go red.** Revert the fix, run
it, see the failure, restore. This is the single highest-value habit in this file,
and it is not theoretical — it has caught, in this repo:

- **A vacuously green suite.** Eight `format-validator` assertions passed because
  the attribute the fixture set (`data-next-format`) was never read by the code
  under test — it only read the legacy `data-format`. Every test passed; none
  tested anything. A negative control (*"and this bad value IS reported"*) is what
  exposed it.
- **A tautological assertion.** `currency-formatter.test.ts` built its expected
  value through the same `Intl` call it was testing, so it could not fail. Assert
  the **observable property** (which side the symbol is on; which character
  separates the decimals), not a re-derivation of the implementation.
- **A test that only restated its own setup.** A locale test called `clearCache()`
  before asserting, so it proved `clearCache` worked rather than that the cache was
  keyed correctly. The real bug needed a locale change **without** a cache clear.

Add at least one **negative control** to any spec whose assertions are all
"something good appears" — a case where the feature must *not* fire.

## 5. Traps specific to this SDK

- **`?debugger=true` mounts the debug overlay; `?debug=true` does not.** The latter
  only turns on AttributeScanner performance logging. Documented at the top of
  `e2e/debug.spec.ts`; costs an hour if rediscovered.
- **Playwright locators pierce open shadow roots.** The overlay, and each of its
  selectors, is a shadow host — `page.locator('#debug-locale-selector #locale-select')`
  just works. Do not hand-roll a recursive `shadowRoot` walk.
- **`window.nextConfig` must be set with `page.addInitScript`**, before
  `/src/index.ts` executes. Setting it in `page.evaluate` after `goto` is too late —
  config is read at boot step 2. Note it replaces the whole object, so the API key
  usually comes from the fixture's `<meta name="next-api-key">`.
- **Pin the browser locale with `test.use({ locale: 'en-US' })`** in any spec whose
  assertions contain a formatted number, date or price. The runner's default is not
  a contract, and a CI machine can differ from a laptop.
- **`Intl` separates a trailing currency symbol with U+202F**, a narrow no-break
  space — `toHaveText('29,99 €')` typed with an ASCII space fails. Use a regex with
  `\s`, which matches it.
- **ICU differs per engine.** Run formatting-sensitive specs on all five projects
  (`npx playwright test e2e/x.spec.ts`), not just `--project=chromium`.
- **The dev server is reused when already running** (`reuseExistingServer` unless
  CI) and readiness is a TCP check, because `GET /` is a 404 — the dev server has no
  root route.

## 6. Naming and layout

```
e2e/<feature>.spec.ts          one spec per feature, named for the feature
e2e/fixtures/<feature>.html    its fixture, same base name
e2e/fixtures/routes.ts         shared stubs + bootSdk + captureEvents
e2e/fixtures/campaign.ts       MINIMAL_CAMPAIGN / RICH_CAMPAIGN
e2e/fixtures/order.ts          TEST_ORDER
```

Vary a fixture campaign by spreading rather than adding a near-duplicate:

```ts
const EUR_CAMPAIGN: Campaign = { ...MINIMAL_CAMPAIGN, currency: 'EUR' };
```

Every spec opens with a comment saying **what behaviour it protects and why a unit
test cannot** — the same standard the rest of the repo holds prose to
(`.claude/rules/documentation.md` §2). Findings discovered while writing a spec go
in that header too; that is where the `?debugger=true` trap above is recorded.
