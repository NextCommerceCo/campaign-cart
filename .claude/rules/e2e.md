# E2E Rules

Applies to everything under `e2e/` — Playwright specs, fixtures, and the shared
harness.

> How to *write* an E2E well — the harness API, the async-assertion patterns, the
> traps — lives in the **`sdk-e2e` skill** (`.claude/skills/sdk-e2e/`). Invoke it
> whenever you touch `e2e/`. Unit-test conventions are in
> [testing.md](./testing.md). This file is the short, non-negotiable **policy**:
> when an E2E is required, and what makes one count.

---

## 1. When an E2E is required

Add or update a spec, in the same change, whenever you:

| You changed… | Because |
|---|---|
| A new DOM-activated feature, or a feature's activating `data-next-*` | Nothing else runs its markup in a browser |
| An enhancer's rendered output, attributes, or classes | Enhancer DOM wiring is explicitly *not* unit-tested ([testing.md](./testing.md)) |
| Anything about what a shopper sees — money, dates, copy, show/hide | Only a browser has the real `Intl`, the real `navigator`, and real layout |
| Anything using a browser API happy-dom fakes or lacks | happy-dom does no layout: `scrollHeight` / `offsetHeight` / `getBoundingClientRect()` are all zero |
| A bug that the unit suite was green through | That is the definition of a coverage hole a unit test cannot close |

The last row is the important one. **A bug that shipped past a full unit suite gets
an E2E, not just a unit regression test.** Two shipped this way recently: the
billing form silently cloning nothing on `data-next-component` pages, and the debug
locale picker never repainting prices. Both had green unit suites throughout.

Conversely: **do not port a passing unit test into E2E.** Five browser projects
means every duplicated assertion is paid for five times, forever.

## 2. A spec must be able to fail

**Watch every new spec go red before you call it done** — revert the fix, run it,
see the failure, restore. Not optional, and not theoretical: a vacuously green
suite, a tautological assertion, and a test that merely restated its own setup have
all been caught in this repo by doing exactly this. The `sdk-e2e` skill §4 has the
three worked examples.

Any spec whose assertions are all "something good appears" needs at least one
**negative control** — a case where the behaviour must *not* fire.

**A caught error is invisible to every other assertion.** No spec here watches the
console today, which is how a malformed shared stub kept 446 tests green while
every cart sync threw (`sdk-e2e` §4b has the case). If your spec's subject touches
the cart, the order, or anything that swallows its own failures, collect
`console.error` and `pageerror` and assert on them.

## 3. A fixture is real markup

`e2e/fixtures/<feature>.html` is the markup Playwright actually runs, so it is the
source to copy from when a `docs/guides/` page needs an example
([docs-layout.md](./docs-layout.md) §6). Fixtures are not published themselves.
Keep real values in them, no placeholders.

## 4. Never touch the network

Every backend call a spec triggers must be stubbed through
`e2e/fixtures/routes.ts`. A spec that reaches `campaigns.apps.29next.com` is
non-deterministic and silently depends on someone's test data. The network is
faked; the SDK under test is always the real one Vite serves — a spec that mocks an
SDK module is testing the mock.

## 5. Know that CI does not run this

`build.yml` runs `type-check`, `test:coverage`, `docs:coverage`, `docs:check` and
`build`. **It does not run `npm run test:e2e`.** Nothing catches a broken spec but
the person who runs it.

So run `npm run test:e2e` yourself before calling a browser-facing change done, and
run the specs you touched on **all five projects** rather than `--project=chromium`
— ICU and layout differ per engine, which is half the reason the suite exists.

---

## Checklist (before calling a browser-facing change done)

- [ ] New DOM-activated feature → spec **and** fixture exist, named for the feature.
- [ ] The new spec has been **seen failing** without the fix.
- [ ] There is a negative control if every other assertion is a positive one.
- [ ] Every backend call is stubbed; nothing reaches the live API.
- [ ] Assertions use auto-retrying locator matchers, not one-shot `textContent()`.
- [ ] Formatting-sensitive specs pin `test.use({ locale })` and ran on all five
      projects.
