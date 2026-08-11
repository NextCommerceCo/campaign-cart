import { test, expect } from '@playwright/test';
import { MINIMAL_CAMPAIGN } from './fixtures/campaign';
import { stubCampaign, stubCart, bootSdk, bootSdkAt } from './fixtures/routes';
import { scopedKey, ROOT_LEVEL_SCOPE } from './fixtures/storage-keys';

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
const FIXTURE_KEY_X = '/e2e/fixtures/storage-scope-key-x.html';
const FIXTURE_KEY_Y = '/e2e/fixtures/storage-scope-key-y.html';
const APOLLO_PRESELL = '/e2e/fixtures/apollo-presell/';
const APOLLO_CHECKOUT = '/e2e/fixtures/apollo-checkout/';

/**
 * The scopes the fixtures' shared API key resolves to under each top folder the specs
 * below serve it from. Written out rather than derived, for the reason
 * `fixtures/storage-keys.ts` gives: an expectation computed by the algorithm under
 * test cannot fail when the algorithm is wrong.
 */
const SCOPE_CAMPAIGN_A = '3lul0u';
const SCOPE_CAMPAIGN_B = '3buzbv';
const SCOPE_HU = '1s8sfud';

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

test('a page that declares no scope derives one without help', async ({
  page,
}) => {
  // The case that matters in production, where the SDK cannot edit the customer's
  // HTML: no scope tag, so it is derived from the API key alone. Every other fixture
  // relies on this — if deriving broke, those specs would seed keys the SDK never
  // reads and fail for a reason that looks unrelated.
  await bootSdk(page, '/e2e/fixtures/add-to-cart.html');
  await page.click(ADD);
  await expect(page.locator(QUANTITY)).toHaveText('1');

  const keys = await page.evaluate(() =>
    Object.keys(sessionStorage).filter(k => k.startsWith('next-cart-state'))
  );

  expect(keys).toEqual([scopedKey('next-cart-state')]);
});

test('two campaign keys in one directory separate with no tag at all', async ({
  page,
}) => {
  // Production: campaigns run on domains the SDK cannot edit, so declaring a scope
  // is not available. These two fixtures sit in the same directory and differ only
  // by `next-api-key` — which is what has to carry the separation.
  await bootSdk(page, FIXTURE_KEY_X);
  await page.click(ADD);
  await expect(page.locator(QUANTITY)).toHaveText('1');

  await bootSdk(page, FIXTURE_KEY_Y);
  await expect(page.locator(QUANTITY)).toHaveText('0');

  await bootSdk(page, FIXTURE_KEY_X);
  await expect(page.locator(QUANTITY)).toHaveText('1');
});

test('one campaign keeps its cart across sibling directories', async ({
  page,
}) => {
  // The regression. Production gives each page of a funnel its own directory —
  // /apollo-presell/, /apollo-checkout/ — so any scope built from the URL changes
  // between them and the shopper arrives at the checkout with an empty cart. Two
  // path-derived scopes shipped and both failed here.
  await bootSdk(page, APOLLO_PRESELL);
  await page.click(ADD);
  await expect(page.locator(QUANTITY)).toHaveText('1');

  await bootSdk(page, APOLLO_CHECKOUT);
  await expect(page.locator(QUANTITY)).toHaveText('1');

  const keys = await page.evaluate(() =>
    Object.keys(sessionStorage).filter(k => k.startsWith('next-cart-state'))
  );

  // One entry, not two — the two directories did not each mint their own.
  expect(keys).toEqual([scopedKey('next-cart-state')]);
});

test('two top folders on one campaign key keep separate carts', async ({
  page,
}) => {
  // The case the campaign token cannot see. One fixture, one API key, served at two
  // URLs that differ only in their first path segment — which is the whole input.
  await bootSdkAt(page, '/campaign-a/offer/presell', 'add-to-cart.html');
  await page.click(ADD);
  await expect(page.locator(QUANTITY)).toHaveText('1');

  await bootSdkAt(page, '/campaign-b/offer/presell', 'add-to-cart.html');
  await expect(page.locator(QUANTITY)).toHaveText('0');
  await page.click(ADD);
  await expect(page.locator(QUANTITY)).toHaveText('1');

  // Not just "B was empty" — A still holds its own cart, so the two coexist rather
  // than one clearing the other.
  await bootSdkAt(page, '/campaign-a/offer/presell', 'add-to-cart.html');
  await expect(page.locator(QUANTITY)).toHaveText('1');

  const keys = await page.evaluate(() =>
    Object.keys(sessionStorage)
      .filter(k => k.startsWith('next-cart-state'))
      .sort()
  );

  expect(keys).toEqual(
    [
      scopedKey('next-cart-state', SCOPE_CAMPAIGN_A),
      scopedKey('next-cart-state', SCOPE_CAMPAIGN_B),
    ].sort()
  );
});

test('one top folder holds the cart however deep the page is', async ({
  page,
}) => {
  // The production layout: a locale folder with the whole campaign under it. Only
  // the first segment counts, so walking from the offer to the checkout to an upsell
  // must not move the scope even though every one of those URLs is different.
  await bootSdkAt(page, '/hu/earbuds', 'add-to-cart.html');
  await page.click(ADD);
  await expect(page.locator(QUANTITY)).toHaveText('1');

  await bootSdkAt(page, '/hu/earbuds/checkout', 'add-to-cart.html');
  await expect(page.locator(QUANTITY)).toHaveText('1');

  await bootSdkAt(page, '/hu/earbuds/checkout/upsell1', 'add-to-cart.html');
  await expect(page.locator(QUANTITY)).toHaveText('1');

  const keys = await page.evaluate(() =>
    Object.keys(sessionStorage)
      .filter(k => k.startsWith('next-cart-state'))
      .sort()
  );

  // One entry, not three.
  expect(keys).toEqual([scopedKey('next-cart-state', SCOPE_HU)]);
});

test('a page at the top level does not take its own segment as a folder', async ({
  page,
}) => {
  // The regression, in the shape the URL actually takes. `/apollo-presell/` and
  // `/apollo-checkout/` have no folder above them, so neither may contribute a
  // token — counting their one segment is what emptied the cart twice before.
  await bootSdkAt(page, '/apollo-presell/', 'add-to-cart.html');
  await page.click(ADD);
  await expect(page.locator(QUANTITY)).toHaveText('1');

  await bootSdkAt(page, '/apollo-checkout/', 'add-to-cart.html');
  await expect(page.locator(QUANTITY)).toHaveText('1');

  const keys = await page.evaluate(() =>
    Object.keys(sessionStorage)
      .filter(k => k.startsWith('next-cart-state'))
      .sort()
  );

  expect(keys).toEqual([scopedKey('next-cart-state', ROOT_LEVEL_SCOPE)]);
});
