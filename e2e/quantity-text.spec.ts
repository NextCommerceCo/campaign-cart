import { test, expect } from '@playwright/test';
import { stubAll, bootSdk } from './fixtures/routes';

/**
 * E2E for the quantity text enhancer (`data-next-quantity-text`).
 *
 * The template supports {qty}, arithmetic ({qty*3}), and singular/plural
 * ({singular|plural}) substitutions. With the default quantity of 1 and no
 * upsell quantity control present, the render is static and deterministic.
 */

const FIXTURE = '/e2e/fixtures/quantity-text.html';

test.beforeEach(async ({ page }) => {
  await stubAll(page);
});

test('renders qty, arithmetic and singular/plural substitutions', async ({
  page,
}) => {
  await bootSdk(page, FIXTURE);

  // Template "{qty} {item|items}, get {qty*3}" with qty=1 => "1 item, get 3".
  await expect(page.locator('#qty-text')).toHaveText('1 item, get 3');
});
