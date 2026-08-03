import { test, expect } from '@playwright/test';
import { MINIMAL_CAMPAIGN } from './fixtures/campaign';
import { stubCampaign, stubCart, bootSdk } from './fixtures/routes';

/**
 * E2E for the checkout-review enhancer (`data-next-enhancer="checkout-review"`).
 *
 * The enhancer reads the checkout store's `formData` and renders each
 * `[data-next-checkout-review="<field>"]` child as textContent; empty fields
 * get the `next-review-empty` class. The checkout store persists to
 * sessionStorage under `next-checkout-store`, so we seed it before boot (the
 * store hydrates synchronously on creation) to simulate arriving from a
 * previous step.
 */

const FIXTURE = '/e2e/fixtures/checkout-review.html';

test.beforeEach(async ({ page }) => {
  await stubCampaign(page, MINIMAL_CAMPAIGN);
  await stubCart(page);

  // Seed the persisted checkout store with email/fname/lname (no city) before
  // any page script runs.
  await page.addInitScript(() => {
    sessionStorage.setItem(
      'next-checkout-store',
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
  });
});

test('renders persisted formData and flags empty fields', async ({ page }) => {
  await bootSdk(page, FIXTURE);

  await expect(
    page.locator('[data-next-checkout-review="email"]')
  ).toHaveText('shopper@example.com');
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
