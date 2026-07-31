import { test, expect } from '@playwright/test';
import { MINIMAL_CAMPAIGN } from './fixtures/campaign';
import { stubCampaign, stubCart, bootSdk, captureEvents } from './fixtures/routes';

/**
 * Model E2E spec for an API-driven enhancer.
 *
 * The Campaign Cart SDK talks to `campaigns.apps.29next.com`, so a deterministic
 * E2E stubs those calls with the shared `./fixtures/routes` helpers instead of
 * hitting the live backend. The fixture (`fixtures/add-to-cart.html`) loads the
 * real SDK from the Vite dev server; only the network is faked.
 *
 * Run with: `npm run test:e2e` (the config's webServer starts `npm run dev`).
 */

const FIXTURE = '/e2e/fixtures/add-to-cart.html';

test.beforeEach(async ({ page }) => {
  // One purchasable package (ref_id 1) is all this fixture references.
  await stubCampaign(page, MINIMAL_CAMPAIGN);
  await stubCart(page);
});

test('adds a package to the cart and emits cart:item-added', async ({ page }) => {
  await bootSdk(page, FIXTURE);

  const added = await captureEvents(page, 'cart:item-added');

  await page.click('[data-next-action="add-to-cart"]');

  // `cart:item-added` fires twice: once from the cart store operation (no
  // `source`) and once from the add-to-cart handler with `source: 'direct'`.
  // Assert on the handler's payload, which carries the source of the add.
  await expect
    .poll(async () => (await added.all()).some((e: any) => e.source === 'direct'))
    .toBe(true);

  const payloads = await added.all();
  expect(payloads.every((e: any) => e.packageId === 1)).toBe(true);
});

test('reflects the added item in the cart.totalQuantity display', async ({
  page,
}) => {
  await bootSdk(page, FIXTURE);

  await page.click('[data-next-action="add-to-cart"]');

  await expect(
    page.locator('[data-next-display="cart.totalQuantity"]')
  ).toHaveText('1');
});
