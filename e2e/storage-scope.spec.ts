import { test, expect } from '@playwright/test';
import { MINIMAL_CAMPAIGN } from './fixtures/campaign';
import { stubCampaign, stubCart, bootSdk } from './fixtures/routes';
import {
  scopedKey,
  FIXTURE_STORAGE_SCOPE as SCOPE,
} from './fixtures/storage-keys';

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
const FUNNEL_APOLLO = '/e2e/fixtures/funnel-apollo.html';
const FUNNEL_ZEUS = '/e2e/fixtures/funnel-zeus.html';

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

test('two funnels on one campaign key keep separate carts', async ({
  page,
}) => {
  // The case the campaign token cannot see. Both fixtures declare the same
  // `next-api-key`; only `next-funnel` tells them apart, and it is a tag the page
  // already carries for attribution rather than anything new to add.
  await bootSdk(page, FUNNEL_APOLLO);
  await page.click(ADD);
  await expect(page.locator(QUANTITY)).toHaveText('1');

  await bootSdk(page, FUNNEL_ZEUS);
  await expect(page.locator(QUANTITY)).toHaveText('0');

  await bootSdk(page, FUNNEL_APOLLO);
  await expect(page.locator(QUANTITY)).toHaveText('1');

  const keys = await page.evaluate(() =>
    Object.keys(sessionStorage)
      .filter(k => k.startsWith('next-cart-state'))
      .sort()
  );

  expect(keys).toEqual([scopedKey('next-cart-state', `${SCOPE}-apollo`)]);
});

test('a page of a tagged funnel that omits the tag inherits its scope', async ({
  page,
}) => {
  // The failure the pointer exists to stop: one page of a tagged funnel loses its
  // `next-funnel` tag in an edit, resolves to the campaign token alone, and the
  // shopper reaches it with an empty cart. The untagged fixture is a different
  // directory as well, so nothing about the URL is carrying this.
  await bootSdk(page, FUNNEL_APOLLO);
  await page.click(ADD);
  await expect(page.locator(QUANTITY)).toHaveText('1');

  await bootSdk(page, APOLLO_PRESELL);
  await expect(page.locator(QUANTITY)).toHaveText('1');

  const keys = await page.evaluate(() =>
    Object.keys(sessionStorage)
      .filter(k => k.startsWith('next-cart-state'))
      .sort()
  );

  // One entry under the funnel's scope — the untagged page did not mint a second
  // one under the bare campaign token.
  expect(keys).toEqual([scopedKey('next-cart-state', `${SCOPE}-apollo`)]);
});

test('an untagged page seen first is not adopted by a funnel later', async ({
  page,
}) => {
  // The negative control on the pointer: inheriting only ever runs downhill, from a
  // page that named a funnel to one that did not. A cart built before any funnel was
  // named stays where it was, so the pointer cannot be a way for one funnel to pick
  // up another page's cart.
  await bootSdk(page, APOLLO_PRESELL);
  await page.click(ADD);
  await expect(page.locator(QUANTITY)).toHaveText('1');

  await bootSdk(page, FUNNEL_APOLLO);
  await expect(page.locator(QUANTITY)).toHaveText('0');

  // Build a cart here too, so both scopes are on disk and can be told apart.
  await page.click(ADD);
  await expect(page.locator(QUANTITY)).toHaveText('1');

  const keys = await page.evaluate(() =>
    Object.keys(sessionStorage)
      .filter(k => k.startsWith('next-cart-state'))
      .sort()
  );

  expect(keys).toEqual([
    scopedKey('next-cart-state'),
    scopedKey('next-cart-state', `${SCOPE}-apollo`),
  ]);
});
