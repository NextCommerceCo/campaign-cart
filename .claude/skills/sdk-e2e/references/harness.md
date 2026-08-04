# E2E harness reference

The concrete API behind [`SKILL.md`](../SKILL.md) §1. Source:
[`e2e/fixtures/routes.ts`](../../../../e2e/fixtures/routes.ts).

## Stubs

Each wraps `page.route` and fulfils with JSON. Call them in `beforeEach`, before
`bootSdk`.

| Helper | Intercepts | Default payload |
|---|---|---|
| `stubCampaign(page, campaign?)` | `**/api/v1/campaigns/**` | `RICH_CAMPAIGN` |
| `stubCart(page)` | `**/api/v1/carts/calculate/**` | `{ lines: [], totals: {} }` |
| `stubOrder(page, order?)` | `**/api/v1/orders/**` | `TEST_ORDER` |
| `stubProspectCart(page)` | `**/api/v1/prospect-carts/**` | `{ id, cart_id }` |
| `stubAddressAutocomplete(page, suggestions?)` | `**/api/v1/addresses/autocomplete/**` | `[]` |
| `stubAll(page, { campaign? })` | campaign **+** cart | — |

`stubAll` is campaign + cart only. Order, prospect-cart and address stubs are
opt-in because most specs do not need them — add them explicitly rather than
widening `stubAll`.

`stubCart` returns an empty summary on purpose: totals are computed client-side by
the SDK's cart-calculator, so this only has to resolve the debounced recalculation
call with something well-formed.

## Boot

```ts
await bootSdk(page, '/e2e/fixtures/my-feature.html');
```

`page.goto` plus `waitForFunction(() => window.next?.on)`. Append query params to
the fixture path when a spec needs them:

```ts
await bootSdk(page, `${FIXTURE}?debugger=true`);
```

## Events

```ts
const added = await captureEvents(page, 'cart:item-added');   // AFTER bootSdk,
await page.click('[data-next-action="add-to-cart"]');         // BEFORE the action
await expect.poll(() => added.count()).toBeGreaterThan(0);
expect(await added.at(0)).toMatchObject({ packageId: 1 });
```

Returns `{ count(), all(), at(index = 0) }`. Registration order matters — an
`EventBus` payload emitted before `captureEvents` ran is gone.

## Campaign fixtures

From [`e2e/fixtures/campaign.ts`](../../../../e2e/fixtures/campaign.ts):

- **`MINIMAL_CAMPAIGN`** — one purchasable non-recurring package, `ref_id: 1`,
  price `29.99`, currency `USD`. Reach for this by default.
- **`RICH_CAMPAIGN`** — `ref_id` 1 (single, with a retail compare-at price), 2
  (qty-3 multi-unit), 3 (monthly recurring), 4/5 (Red/Blue variants of one
  product). Currency `USD`.

`TEST_ORDER` lives in [`e2e/fixtures/order.ts`](../../../../e2e/fixtures/order.ts).

Spread to vary one field; do not clone a whole campaign into a spec:

```ts
const EUR_CAMPAIGN: Campaign = { ...MINIMAL_CAMPAIGN, currency: 'EUR' };
```

## Config

`window.nextConfig` has to exist before `/src/index.ts` runs, so either put it in
the fixture:

```html
<script>window.nextConfig = { utmTransfer: { enabled: true } };</script>
```

…which is right when every test in the spec wants it, or set it per-test:

```ts
await page.addInitScript(() => {
  (window as any).nextConfig = { addressConfig: { enableAutocomplete: true } };
});
```

…which is right when tests in one spec need different config. Either way it
replaces the whole object, so the API key normally stays on the fixture's
`<meta name="next-api-key" content="test-e2e-key">`.

## Browser context

`test.use({ locale: 'de-DE' })` at file or `describe` scope sets `navigator.language`
for the context. Playwright also offers `timezoneId`, `geolocation`, `colorScheme`
and `viewport` the same way — prefer these over stubbing the browser API, since
they exercise the real one.

## Running

```bash
npm run test:e2e                              # all specs, all 5 projects
npx playwright test e2e/x.spec.ts             # one spec, all projects
npx playwright test e2e/x.spec.ts --project=chromium --reporter=line
npx playwright test -g "part of the title"    # by title
```

Projects: `chromium`, `firefox`, `webkit`, `Mobile Chrome` (Pixel 5),
`Mobile Safari` (iPhone 12). Config: [`playwright.config.ts`](../../../../playwright.config.ts).
CI gets 2 retries and 1 worker; local gets none and full parallelism, so a spec
that only passes locally is usually order-dependent.

Failure artefacts: `trace: 'on-first-retry'`, `screenshot: 'only-on-failure'`,
written to `test-results/`.

**`npm run test:e2e` is not part of `build.yml`.** Nothing in CI runs Playwright
today — see [`.claude/rules/e2e.md`](../../../rules/e2e.md) on what that means for
when you run it yourself.
