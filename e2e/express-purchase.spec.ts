import { test, expect } from '@playwright/test';
import type { Campaign } from '../src/types/campaign';
import type { Order } from '../src/types/api';
import { MINIMAL_CAMPAIGN } from './fixtures/campaign';
import { TEST_ORDER } from './fixtures/order';
import { stubCampaign, stubCart, bootSdk } from './fixtures/routes';

/**
 * `dl_purchase` must describe a purchase that happened —
 * [issue #71](https://github.com/NextCommerceCo/campaign-cart/issues/71).
 *
 * Express checkout creates the order *before* the shopper pays: the orders API
 * answers with a `payment_complete_url` and the SDK sends them to PayPal with it.
 * The purchase event used to be raised at that point and parked in
 * `sessionStorage`, so it fired on whatever page came next — including the
 * checkout page the shopper landed back on by pressing **back**. Eight such
 * events in one week at one merchant, four from sessions with no order at all,
 * and an affiliate network paid out on six of them.
 *
 * Why this cannot be a unit test: the bug lives in the *page transitions*. It
 * needs a real navigation away from the site, a real back-navigation, a second
 * real SDK boot, and the sessionStorage queue surviving all three. happy-dom has
 * one document and no history.
 *
 * The success leg is the negative control in reverse: it proves the fix did not
 * simply stop reporting purchases.
 */

const CAMPAIGN_WITH_PAYPAL: Campaign = {
  ...MINIMAL_CAMPAIGN,
  available_express_payment_methods: [{ code: 'paypal', label: 'PayPal' }],
};

const CHECKOUT = '/e2e/fixtures/express-purchase.html';
const GATEWAY = '/e2e/fixtures/express-gateway.html';
/** What the checkout fixture names in its `next-failure-url` meta tag. */
const FAILED = '/e2e/fixtures/express-purchase-failed.html';

/**
 * What `POST /api/v1/orders/` returns for an express order: a real order record
 * that nobody has paid for yet. `payment_complete_url` points at the local
 * stand-in gateway so the redirect stays inside the test.
 */
const PENDING_ORDER: Order = {
  ...TEST_ORDER,
  number: 'E2E-PENDING',
  payment_complete_url: GATEWAY,
};

/** The same order after the gateway took the money — no gateway URL left. */
const PAID_ORDER: Order = { ...TEST_ORDER, number: 'E2E-1001' };

/** Every `dl_purchase` currently in the page's canonical data layer. */
const purchases = (page: import('@playwright/test').Page) =>
  page.evaluate(() =>
    ((window as any).NextDataLayer ?? []).filter(
      (e: any) => e.event === 'dl_purchase'
    )
  );

/** Waits until analytics has finished booting AND replayed its queue. */
async function afterQueueReplay(
  page: import('@playwright/test').Page
): Promise<void> {
  // dl_user_data is the first event of every page; the queue is replayed 200ms
  // after analytics initialises (NextAnalytics.initialize). Waiting for the
  // former and then past the latter is what makes "no purchase event" mean
  // "none arrived", rather than "we looked too early".
  await expect
    .poll(() =>
      page.evaluate(() =>
        ((window as any).NextDataLayer ?? []).some(
          (e: any) => e.event === 'dl_user_data'
        )
      )
    )
    .toBe(true);
  await page.waitForTimeout(1500);
}

test.beforeEach(async ({ page }) => {
  await stubCampaign(page, CAMPAIGN_WITH_PAYPAL);
  await stubCart(page);
});

test('pressing back from the gateway reports no purchase', async ({ page }) => {
  await page.route('**/api/v1/orders/**', route =>
    route.fulfill({ json: PENDING_ORDER })
  );

  await bootSdk(page, CHECKOUT);
  await page.evaluate(() => (window as any).next.addItem({ packageId: 1 }));

  const button = page.locator('[data-next-express-checkout="paypal"]');
  await expect(button).toHaveCount(1);
  await button.click();

  // The SDK redirected to the gateway with the unpaid order.
  await page.waitForURL(`**${GATEWAY}`);
  await expect(page.locator('#gateway')).toBeVisible();

  // Standing on the gateway page, nothing about this order is parked for the
  // next page. This is the deterministic half of the test: the replay below
  // depends on the next page booting in time, but the queue can be read right
  // now. Before the fix this held the whole `dl_purchase`, transaction id
  // `E2E-PENDING` and all, waiting for wherever the shopper went next.
  const queued = await page.evaluate(() =>
    JSON.parse(sessionStorage.getItem('next_v2_pending_events') ?? '[]')
  );
  expect(queued.filter((q: any) => q.event?.event === 'dl_purchase')).toEqual(
    []
  );

  // The shopper changes their mind and presses back.
  await page.goBack();
  await page.waitForFunction(() => Boolean((window as any).next?.on));
  await afterQueueReplay(page);

  expect(await purchases(page)).toEqual([]);
});

test('landing on the failure page reports no purchase, even for an order that looks paid', async ({
  page,
}) => {
  // The worst case on the other leg of the same redirect: `POST` creates the
  // unpaid order, but the `GET` on the landing page answers with an order that
  // carries no `payment_complete_url` at all — so the paid-or-not gate cannot see
  // anything wrong with it. What saves it is knowing that *this page* is the
  // `payment_failed_url` the checkout page sent with the order.
  await page.route('**/api/v1/orders/**', route =>
    route.fulfill({
      json: route.request().method() === 'POST' ? PENDING_ORDER : PAID_ORDER,
    })
  );

  await bootSdk(page, CHECKOUT);
  await page.evaluate(() => (window as any).next.addItem({ packageId: 1 }));
  await page.click('[data-next-express-checkout="paypal"]');
  await page.waitForURL(`**${GATEWAY}`);

  // The gateway declines and sends the shopper to payment_failed_url, with the
  // ref_id on it exactly as the success leg would have.
  await page.goto(`${FAILED}?ref_id=${PAID_ORDER.ref_id}`);
  await page.waitForFunction(() => Boolean((window as any).next?.on));
  await expect(page.locator('#failed')).toBeVisible();
  await afterQueueReplay(page);

  // The order really did load on this page — so "no purchase" is the gate's
  // decision, not a page that never got as far as having an order. Without this,
  // the test would pass just as well against a failure page where `?ref_id=` was
  // ignored.
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          sessionStorage.getItem('next-order')?.includes('E2E-1001') ?? false
      )
    )
    .toBe(true);

  expect(await purchases(page)).toEqual([]);
});

test('returning to success_url reports exactly one purchase, with the order number', async ({
  page,
}) => {
  await page.route('**/api/v1/orders/**', route =>
    route.fulfill({ json: PAID_ORDER })
  );

  // What the gateway's redirect does: back to the site with ?ref_id=, where the
  // SDK loads the finished order.
  await bootSdk(page, `${CHECKOUT}?ref_id=${PAID_ORDER.ref_id}`);
  await afterQueueReplay(page);

  const events = await purchases(page);
  expect(events).toHaveLength(1);
  expect(events[0].ecommerce.transaction_id).toBe('E2E-1001');
  expect(events[0].ecommerce.transaction_id).not.toMatch(/^order_\d+$/);
});

test('reloading the success page does not report the purchase twice', async ({
  page,
}) => {
  await page.route('**/api/v1/orders/**', route =>
    route.fulfill({ json: PAID_ORDER })
  );

  await bootSdk(page, `${CHECKOUT}?ref_id=${PAID_ORDER.ref_id}`);
  await afterQueueReplay(page);
  expect(await purchases(page)).toHaveLength(1);

  await page.reload();
  await page.waitForFunction(() => Boolean((window as any).next?.on));
  await afterQueueReplay(page);

  expect(await purchases(page)).toEqual([]);
});
