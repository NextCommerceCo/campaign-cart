import { test, expect } from '@playwright/test';
import { MINIMAL_CAMPAIGN } from './fixtures/campaign';
import { stubCampaign, stubCart, bootSdk } from './fixtures/routes';

/**
 * Analytics dataLayer: with analytics enabled in `auto` mode, SDK events are
 * pushed to the internal `window.NextDataLayer` as canonical `dl_*` events, and
 * the GTM provider mirrors them onto `window.dataLayer`.
 *
 * The fixture enables analytics + the GTM provider via `window.nextConfig`
 * (analytics is OFF by default). Event names verified in
 * src/core/analytics/tracking/auto-event-listener.ts +
 * src/core/analytics/providers/gtm-adapter.ts.
 */

const FIXTURE = '/e2e/fixtures/analytics.html';

test.beforeEach(async ({ page }) => {
  await stubCampaign(page, MINIMAL_CAMPAIGN);
  await stubCart(page);
});

test('fires dl_user_data on boot (auto mode)', async ({ page }) => {
  await bootSdk(page, FIXTURE);

  await expect
    .poll(() =>
      page.evaluate(() =>
        ((window as any).NextDataLayer ?? []).some(
          (e: any) => e.event === 'dl_user_data'
        )
      )
    )
    .toBe(true);
});

test('pushes dl_add_to_cart to NextDataLayer and mirrors to window.dataLayer', async ({
  page,
}) => {
  await bootSdk(page, FIXTURE);

  await page.click('[data-next-action="add-to-cart"]');

  // Internal canonical data layer receives the dl_add_to_cart event.
  await expect
    .poll(
      () =>
        page.evaluate(
          () =>
            ((window as any).NextDataLayer ?? []).filter(
              (e: any) => e.event === 'dl_add_to_cart'
            ).length
        ),
      { timeout: 10000 }
    )
    .toBeGreaterThan(0);

  // GTM provider mirrors it onto the standard window.dataLayer.
  await expect
    .poll(() =>
      page.evaluate(() =>
        ((window as any).dataLayer ?? []).some(
          (e: any) => e.event === 'dl_add_to_cart'
        )
      )
    )
    .toBe(true);

  // Representative payload: the ecommerce block carries currency + items.
  const event = await page.evaluate(
    () =>
      ((window as any).NextDataLayer ?? [])
        .filter((e: any) => e.event === 'dl_add_to_cart')
        .pop()
  );
  expect(event.ecommerce.currency).toBe('USD');
  expect(Array.isArray(event.ecommerce.items)).toBe(true);
  expect(event.ecommerce.items.length).toBeGreaterThan(0);
});
