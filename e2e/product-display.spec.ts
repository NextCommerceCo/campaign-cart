import { test, expect } from '@playwright/test';
import { stubAll, bootSdk } from './fixtures/routes';

/**
 * E2E for the product display enhancer (`data-next-display="package.*"`).
 *
 * Covers both ways a package is targeted: an explicit id in the path
 * (`package.1.name`) and an ancestor `[data-next-package-id]` context. Also
 * verifies image elements get their `src` set. Values come from RICH_CAMPAIGN
 * (package 1 = "Single Widget" $29.99, package 2 = "Triple Widget Pack" $24.99).
 */

const FIXTURE = '/e2e/fixtures/product-display.html';

test.beforeEach(async ({ page }) => {
  await stubAll(page);
});

test('renders package fields addressed by explicit id in the path', async ({
  page,
}) => {
  await bootSdk(page, FIXTURE);

  await expect(page.locator('#p1-name')).toHaveText('Single Widget');
  await expect(page.locator('#p1-price')).toHaveText('$29.99');
});

test('sets the src of an <img> bound to a package image', async ({ page }) => {
  await bootSdk(page, FIXTURE);

  await expect(page.locator('#p1-image')).toHaveAttribute(
    'src',
    'https://example.test/widget.png'
  );
});

test('resolves package fields from ancestor [data-next-package-id] context', async ({
  page,
}) => {
  await bootSdk(page, FIXTURE);

  await expect(page.locator('#p2-name')).toHaveText('Triple Widget Pack');
  await expect(page.locator('#p2-price')).toHaveText('$24.99');
});
