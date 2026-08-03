import { test, expect } from '@playwright/test';
import { stubAll, stubOrder, bootSdk } from './fixtures/routes';
import { TEST_ORDER } from './fixtures/order';

/**
 * E2E for the order display enhancer (`data-next-display="order.*"`).
 *
 * The enhancer auto-loads the order named by the `?ref_id` URL param, so the
 * fixture is navigated with `?ref_id=test-order-ref` and the order endpoints
 * are stubbed with TEST_ORDER. Verifies order fields render and an `<a>` bound
 * to the status URL gets its `href` set.
 *
 * FINDING: on initial auto-load the display does NOT receive `next-loaded`.
 * `checkAndLoadOrderFromUrl` awaits the order load BEFORE
 * `setupStoreSubscriptions` attaches the store subscription, and the base
 * `subscribe` only fires on change — so the class-toggling `handleOrderUpdate`
 * never runs for the already-present order. Content still renders via
 * `performInitialUpdate`, and the element is shown (`display-visible`).
 */

const FIXTURE = '/e2e/fixtures/order-display.html?ref_id=test-order-ref';

test.beforeEach(async ({ page }) => {
  await stubAll(page);
  await stubOrder(page); // GET /orders/{ref}/ -> TEST_ORDER
});

test('auto-loads the order and renders the display as visible', async ({
  page,
}) => {
  await bootSdk(page, FIXTURE);

  // Content resolves from the auto-loaded order and the element is shown.
  await expect(page.locator('#order-number')).toHaveText(TEST_ORDER.number);
  await expect(page.locator('#order-number')).toHaveClass(/display-visible/);
});

test('renders order number and total from the loaded order', async ({
  page,
}) => {
  await bootSdk(page, FIXTURE);

  await expect(page.locator('#order-number')).toHaveText(TEST_ORDER.number);
  // total_incl_tax "29.99" formatted as currency.
  await expect(page.locator('#order-total')).toHaveText('$29.99');
});

test('sets the href of an <a> bound to order.statusUrl', async ({ page }) => {
  await bootSdk(page, FIXTURE);

  await expect(page.locator('#order-status')).toHaveAttribute(
    'href',
    TEST_ORDER.order_status_url as string
  );
});
