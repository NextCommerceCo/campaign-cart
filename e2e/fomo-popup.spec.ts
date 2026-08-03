import { test, expect } from '@playwright/test';
import { MINIMAL_CAMPAIGN } from './fixtures/campaign';
import { stubCampaign, stubCart, bootSdk, captureEvents } from './fixtures/routes';

/**
 * E2E for the FomoPopupEnhancer (behavior/).
 *
 * ACTIVATION PATH: not DOM-scanned. It is constructed on document.body and
 * driven through the public SDK API `window.next.fomo(config)`
 * (src/core/next-commerce.ts:814 → lazy-imports the enhancer, calls
 * setup(config) then start()). We call it with tiny delays and explicit
 * items/customers so the first popup shows immediately and deterministically.
 */

const FIXTURE = '/e2e/fixtures/fomo-popup.html';

const IMAGE =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='60' height='60'%3E%3Crect width='60' height='60' fill='%23f00'/%3E%3C/svg%3E";

test.beforeEach(async ({ page }) => {
  await stubCampaign(page, MINIMAL_CAMPAIGN);
  await stubCart(page);
});

test('fomo() shows a social-proof popup and emits fomo:shown', async ({
  page,
}) => {
  await bootSdk(page, FIXTURE);

  const shown = await captureEvents(page, 'fomo:shown');

  await page.evaluate(
    ({ image }) =>
      (window as any).next.fomo({
        items: [{ text: 'Test Product', image }],
        customers: { US: ['Alex from Testville'] },
        country: 'US',
        initialDelay: 0,
        displayDuration: 5000,
        delayBetween: 12000,
      }),
    { image: IMAGE }
  );

  await expect.poll(async () => (await shown.all()).length).toBeGreaterThan(0);
  expect(await shown.at(0)).toMatchObject({
    customer: 'Alex from Testville',
    product: 'Test Product',
    image: IMAGE,
  });

  const wrapper = page.locator('.next-fomo-wrapper');
  await expect(wrapper).toHaveClass(/next-fomo-show/);
  await expect(wrapper.locator('.next-fomo-customer')).toHaveText(
    'Alex from Testville'
  );
  await expect(wrapper.locator('.next-fomo-product')).toHaveText(
    'Test Product'
  );
});
