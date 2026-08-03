import { test, expect } from '@playwright/test';
import { MINIMAL_CAMPAIGN } from './fixtures/campaign';
import { stubCampaign, stubCart, stubOrder, bootSdk, captureEvents } from './fixtures/routes';

/**
 * E2E for the post-purchase upsell enhancer (`data-next-upsell`).
 *
 * The fixture is loaded with `?ref_id=test-order-ref`, so the SDK auto-loads
 * TEST_ORDER (which has `supports_post_purchase_upsells: true`). Accepting the
 * offer POSTs to `orders/{ref}/upsells/` (handled by `stubOrder`).
 *
 * `upsell:initialized` fires during the DOM scan — before `window.next` exists
 * and before a post-boot listener could attach — and `data-next-upsell` is not
 * in the DOMObserver's attribute filter, so it can't be re-triggered by a
 * dynamic insert either. The fixture therefore buffers it from the shared
 * EventBus singleton into `window.__capturedEvents`.
 */

const FIXTURE = '/e2e/fixtures/upsell.html?ref_id=test-order-ref';

test.beforeEach(async ({ page }) => {
  await stubCampaign(page, MINIMAL_CAMPAIGN);
  await stubCart(page);
  await stubOrder(page);
});

test('emits upsell:initialized {packageId, element} on boot', async ({
  page,
}) => {
  await bootSdk(page, FIXTURE);

  const events = await page.evaluate(
    () => (window as any).__capturedEvents['upsell:initialized']
  );

  expect(events.length).toBeGreaterThan(0);
  expect(events[0].packageId).toBe(1);
  expect(events[0].hasElement).toBe(true);
});

test('accepting the offer emits upsell:adding then upsell:added', async ({
  page,
}) => {
  await bootSdk(page, FIXTURE);

  // The order must be in the store before the accept click (canAddUpsells()).
  // The order.number display gates readiness.
  await expect(page.locator('[data-next-display="order.number"]')).toHaveText(
    'E2E-1001'
  );

  const adding = await captureEvents(page, 'upsell:adding');
  const added = await captureEvents(page, 'upsell:added');

  await page.click('[data-next-upsell-action="add"]');

  await expect.poll(async () => await adding.count()).toBeGreaterThan(0);
  await expect.poll(async () => await added.count()).toBeGreaterThan(0);

  const addingPayload = await adding.at(0);
  expect(addingPayload.packageId).toBe(1);

  const addedPayload = await added.at(0);
  expect(addedPayload.packageId).toBe(1);
  expect(addedPayload.quantity).toBe(1);
  expect(addedPayload.willRedirect).toBe(false);
  expect(addedPayload.order?.ref_id).toBe('test-order-ref');
});
