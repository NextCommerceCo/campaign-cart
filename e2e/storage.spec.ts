import { test, expect } from '@playwright/test';
import { MINIMAL_CAMPAIGN } from './fixtures/campaign';
import { TEST_ORDER } from './fixtures/order';
import { stubCampaign, stubCart, stubOrder, bootSdk } from './fixtures/routes';

/**
 * Persistence: the cart and campaign stores persist to sessionStorage, so a
 * same-session reload restores them; the order store persists too but carries a
 * 15-minute freshness stamp (`orderLoadedAt`) enforced by `isOrderExpired()`.
 *
 * Discovered storage keys (all sessionStorage):
 *  - cart        → `next-cart-state`
 *  - campaign    → `next-campaign-cache_{CURRENCY}` (e.g. `next-campaign-cache_USD`)
 *  - order       → `next-order`
 *  - attribution → `next-attribution`
 * (src/core/storage.ts; src/state/order/order.state.ts;
 *  src/state/attribution/attribution.state.ts)
 */

const FIXTURE = '/e2e/fixtures/storage.html';

test.beforeEach(async ({ page }) => {
  await stubCampaign(page, MINIMAL_CAMPAIGN);
  await stubCart(page);
});

test('cart persists to sessionStorage under next-cart-state', async ({
  page,
}) => {
  await bootSdk(page, FIXTURE);

  await page.click('[data-next-action="add-to-cart"]');
  await expect(
    page.locator('[data-next-display="cart.totalQuantity"]')
  ).toHaveText('1');

  // The persisted cart holds the added item.
  const stored = await page.evaluate(() =>
    sessionStorage.getItem('next-cart-state')
  );
  expect(stored).toBeTruthy();
  const parsed = JSON.parse(stored as string);
  const items = parsed.state?.items ?? parsed.items;
  expect(items.some((i: any) => i.packageId === 1)).toBe(true);

  // Campaign is cached too (currency-scoped key).
  const campaignKey = await page.evaluate(() =>
    Object.keys(sessionStorage).find(k => k.startsWith('next-campaign-cache'))
  );
  expect(campaignKey).toBeTruthy();
});

test('cart is restored after a same-session reload', async ({ page }) => {
  await bootSdk(page, FIXTURE);
  await page.click('[data-next-action="add-to-cart"]');
  await expect(
    page.locator('[data-next-display="cart.totalQuantity"]')
  ).toHaveText('1');

  // Reload — sessionStorage survives within the same page/session.
  await page.reload();
  await page.waitForFunction(() => Boolean((window as any).next?.on));

  await expect(
    page.locator('[data-next-display="cart.totalQuantity"]')
  ).toHaveText('1');
});

test('order persists under next-order with a 15-minute TTL', async ({
  page,
}) => {
  await stubOrder(page, TEST_ORDER);

  // ref_id triggers auto-load of the order at boot.
  await bootSdk(page, `${FIXTURE}?ref_id=${TEST_ORDER.ref_id}`);

  // Persisted order carries the freshness stamp used for expiry.
  const stored = await page.evaluate(() =>
    sessionStorage.getItem('next-order')
  );
  expect(stored).toBeTruthy();
  const parsed = JSON.parse(stored as string);
  expect(parsed.state.order.ref_id).toBe(TEST_ORDER.ref_id);
  expect(typeof parsed.state.orderLoadedAt).toBe('number');

  // Exercise the TTL directly: fresh → not expired; stamp aged past 15 min →
  // expired.
  const ttl = await page.evaluate(async () => {
    const { useOrderStore }: any = await import('/src/index.ts');
    const freshExpired = useOrderStore.getState().isOrderExpired();
    useOrderStore.setState({ orderLoadedAt: Date.now() - 16 * 60 * 1000 });
    const agedExpired = useOrderStore.getState().isOrderExpired();
    return { freshExpired, agedExpired };
  });
  expect(ttl.freshExpired).toBe(false);
  expect(ttl.agedExpired).toBe(true);
});
