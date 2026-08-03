import { test, expect } from '@playwright/test';
import { MINIMAL_CAMPAIGN } from './fixtures/campaign';
import { TEST_ORDER } from './fixtures/order';
import { stubCampaign, stubCart, stubOrder, bootSdk } from './fixtures/routes';

/**
 * E2E for the order-item-list enhancer (`data-next-order-items`).
 *
 * The host auto-loads the order from the URL `ref_id`, then renders one
 * `.order-item[data-order-line-id]` per line using its default template.
 */

const FIXTURE = '/e2e/fixtures/order-item-list.html?ref_id=test-order-ref';

test.beforeEach(async ({ page }) => {
  await stubCampaign(page, MINIMAL_CAMPAIGN);
  await stubCart(page);
  await stubOrder(page); // GET /orders/{ref}/ → TEST_ORDER
});

test('auto-loads the order and renders its single line', async ({ page }) => {
  await bootSdk(page, FIXTURE);

  const host = page.locator('[data-next-order-items]');

  // Host reflects the loaded, non-empty order.
  await expect(host).toHaveClass(/order-has-items/);

  // Exactly one rendered row — TEST_ORDER has one line.
  const rows = host.locator('.order-item[data-order-line-id]');
  await expect(rows).toHaveCount(1);

  // The row carries the stubbed line's product title and a line total.
  const line = TEST_ORDER.lines[0];
  await expect(rows.first().locator('.order-item-name')).toContainText(
    line.product_title
  );
  await expect(rows.first().locator('.line-total')).not.toBeEmpty();

  // The rendered row id matches the stubbed line id.
  await expect(rows.first()).toHaveAttribute(
    'data-order-line-id',
    String(line.id)
  );
});
