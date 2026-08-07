import { test, expect } from '@playwright/test';
import { MINIMAL_CAMPAIGN } from './fixtures/campaign';
import { stubCampaign, stubCart, bootSdk } from './fixtures/routes';
import { scopedKey } from './fixtures/storage-keys';

/**
 * Two campaigns on one origin must not share a cart.
 *
 * `my-campaigns.pages.dev` hosts many campaigns, so `/funnel-a/checkout` and
 * `/promo-b.html` are one origin and one sessionStorage. Before the `__{scope}`
 * suffix, funnel B rehydrated funnel A's `next-cart-state` — its packages, its
 * shipping method and, most expensively, its applied vouchers, each carrying the
 * discount rule it matched from a campaign B never declared.
 *
 * Only a browser can show this: it needs two real page loads against one
 * sessionStorage, with the SDK deciding its own key at module-creation time on
 * each. The fixtures declare their scopes with `<meta name="next-storage-scope">`
 * because both are served from `/e2e/fixtures/`, which would otherwise derive the
 * same scope for both.
 */

const FIXTURE_A = '/e2e/fixtures/storage-scope-a.html';
const FIXTURE_B = '/e2e/fixtures/storage-scope-b.html';

const QUANTITY = '[data-next-display="cart.totalQuantity"]';
const ADD = '[data-next-action="add-to-cart"]';

test.beforeEach(async ({ page }) => {
  await stubCampaign(page, MINIMAL_CAMPAIGN);
  await stubCart(page);
});

test("a second campaign on the same origin does not inherit the first's cart", async ({
  page,
}) => {
  await bootSdk(page, FIXTURE_A);
  await page.click(ADD);
  await expect(page.locator(QUANTITY)).toHaveText('1');

  // The negative control, and the whole point of the change: same origin, same
  // sessionStorage, different funnel — the cart must not follow.
  await bootSdk(page, FIXTURE_B);
  await expect(page.locator(QUANTITY)).toHaveText('0');
});

test("the first campaign's cart is still there when the shopper returns", async ({
  page,
}) => {
  // Without this, clearing the cart on every navigation would pass the test above
  // just as well as isolating it does.
  await bootSdk(page, FIXTURE_A);
  await page.click(ADD);
  await expect(page.locator(QUANTITY)).toHaveText('1');

  await bootSdk(page, FIXTURE_B);
  await expect(page.locator(QUANTITY)).toHaveText('0');

  await bootSdk(page, FIXTURE_A);
  await expect(page.locator(QUANTITY)).toHaveText('1');
});

test('each funnel writes its own cart key, and both survive', async ({
  page,
}) => {
  await bootSdk(page, FIXTURE_A);
  await page.click(ADD);
  await expect(page.locator(QUANTITY)).toHaveText('1');

  await bootSdk(page, FIXTURE_B);
  await page.click(ADD);
  await expect(page.locator(QUANTITY)).toHaveText('1');

  const keys = await page.evaluate(() =>
    Object.keys(sessionStorage)
      .filter(k => k.startsWith('next-cart-state'))
      .sort()
  );

  expect(keys).toEqual([
    scopedKey('next-cart-state', 'funnel-a'),
    scopedKey('next-cart-state', 'funnel-b'),
  ]);
});

test('a page that declares no scope derives one from its path', async ({
  page,
}) => {
  // Every other fixture relies on this: no meta tag, so the scope is the first
  // path segment of `/e2e/fixtures/…`. If deriving broke, those specs would seed
  // keys the SDK never reads and fail for a reason that looks unrelated.
  await bootSdk(page, '/e2e/fixtures/add-to-cart.html');
  await page.click(ADD);
  await expect(page.locator(QUANTITY)).toHaveText('1');

  const keys = await page.evaluate(() =>
    Object.keys(sessionStorage).filter(k => k.startsWith('next-cart-state'))
  );

  expect(keys).toEqual([scopedKey('next-cart-state')]);
});
