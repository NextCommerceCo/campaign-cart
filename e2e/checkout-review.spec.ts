import { test, expect } from '@playwright/test';
import { CHECKOUT_KEY } from './fixtures/storage-keys';
import { MINIMAL_CAMPAIGN } from './fixtures/campaign';
import { stubCampaign, stubCart, bootSdk } from './fixtures/routes';

/**
 * E2E for the checkout-review enhancer (`data-next-enhancer="checkout-review"`).
 *
 * The enhancer reads the checkout store's `formData` and renders each
 * `[data-next-checkout-review="<field>"]` child as textContent; empty fields
 * get the `next-review-empty` class. The checkout store persists to
 * sessionStorage under `next-checkout-store__{scope}`, so we seed it before boot (the
 * store hydrates synchronously on creation) to simulate arriving from a
 * previous step.
 */

const FIXTURE = '/e2e/fixtures/checkout-review.html';

test.beforeEach(async ({ page }) => {
  await stubCampaign(page, MINIMAL_CAMPAIGN);
  await stubCart(page);

  // Seed the persisted checkout store with email/fname/lname (no city) before
  // any page script runs.
  await page.addInitScript(key => {
    sessionStorage.setItem(
      key,
      JSON.stringify({
        state: {
          formData: {
            email: 'shopper@example.com',
            fname: 'Ada',
            lname: 'Lovelace',
          },
        },
        version: 0,
      })
    );
  }, CHECKOUT_KEY);
});

test('renders persisted formData and flags empty fields', async ({ page }) => {
  await bootSdk(page, FIXTURE);

  await expect(page.locator('[data-next-checkout-review="email"]')).toHaveText(
    'shopper@example.com'
  );
  await expect(page.locator('[data-next-checkout-review="fname"]')).toHaveText(
    'Ada'
  );
  await expect(page.locator('[data-next-checkout-review="lname"]')).toHaveText(
    'Lovelace'
  );

  // A populated field is not flagged empty.
  await expect(
    page.locator('[data-next-checkout-review="email"]')
  ).not.toHaveClass(/next-review-empty/);

  // city was not seeded → rendered empty and flagged.
  const city = page.locator('[data-next-checkout-review="city"]');
  await expect(city).toHaveText('');
  await expect(city).toHaveClass(/next-review-empty/);
});

/** The orders API's names, which a page should write, read what the SDK keeps under fname. */
test('reads first_name and last_name from where the SDK keeps them', async ({
  page,
}) => {
  await page.route('**/e2e/fixtures/checkout-review.html', async route => {
    const response = await route.fetch();
    const body = (await response.text())
      .replace('data-next-checkout-review="fname"', 'data-next-checkout-review="first_name"')
      .replace('data-next-checkout-review="lname"', 'data-next-checkout-review="last_name"');
    await route.fulfill({ response, body });
  });
  await bootSdk(page, FIXTURE);

  await expect(
    page.locator('[data-next-checkout-review="first_name"]')
  ).toHaveText('Ada');
  await expect(
    page.locator('[data-next-checkout-review="last_name"]')
  ).toHaveText('Lovelace');
});
