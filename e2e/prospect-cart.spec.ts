import { test, expect, type Page } from '@playwright/test';
import { MINIMAL_CAMPAIGN } from './fixtures/campaign';
import { stubCampaign, stubCart, stubProspectCart, bootSdk } from './fixtures/routes';

/**
 * E2E for the prospect-cart enhancer.
 *
 * prospect-cart is not DOM-scanned; it is created inside CheckoutFormEnhancer.
 * With trigger-on=emailEntry it creates a prospect cart once email + first/last
 * name are valid AND the cart has items, then dispatches the DOM CustomEvent
 * `next:prospect-cart-created` on the form (NOT an EventBus event).
 *
 * The prospect cart is created via the standard cart API (`POST /carts/`,
 * distinct from the `/carts/calculate/` stub), so we stub that to return a
 * checkout_url.
 */

const FIXTURE = '/e2e/fixtures/prospect-cart.html';

/** Stub the country/states CDN the checkout form's CountryService calls. */
async function stubCountryService(page: Page): Promise<void> {
  await page.route('**/cdn-countries.muddy-wind-c7ca.workers.dev/**', route => {
    const url = route.request().url();
    if (url.includes('/location')) {
      return route.fulfill({
        json: {
          detectedCountryCode: 'US',
          countries: [{ code: 'US', name: 'United States' }],
        },
      });
    }
    return route.fulfill({
      json: {
        countryConfig: { stateLabel: 'State', stateRequired: false, postcodeLabel: 'ZIP' },
        states: [],
      },
    });
  });
}

test.beforeEach(async ({ page }) => {
  await stubCampaign(page, MINIMAL_CAMPAIGN);
  await stubCart(page);
  await stubProspectCart(page);
  await stubCountryService(page);

  // createCart posts to /carts/ (not /carts/calculate/). Registered after
  // stubCart; the calculate glob does not match this exact path.
  await page.route('**/api/v1/carts/', route =>
    route.fulfill({
      json: { checkout_url: 'https://example.test/checkout/prospect-1' },
    })
  );
});

test('creates a prospect cart and fires next:prospect-cart-created on the form', async ({
  page,
}) => {
  await bootSdk(page, FIXTURE);

  // The prospect cart is only created when the cart has items.
  await page.evaluate(() => (window as any).next.addItem({ packageId: 1 }));

  // Listen for the DOM CustomEvent on the form BEFORE entering contact details.
  const created = page.evaluate(
    () =>
      new Promise<{ hasCart: boolean; hasProspectCart: boolean }>(resolve => {
        const form = document.querySelector('form[data-next-checkout]')!;
        form.addEventListener(
          'next:prospect-cart-created',
          (e: Event) => {
            const detail = (e as CustomEvent).detail;
            resolve({
              hasCart: !!detail?.cart,
              hasProspectCart: !!detail?.prospectCart,
            });
          },
          { once: true }
        );
      })
  );

  // Enter valid email + first/last name (emailEntry trigger requires all three).
  await page.fill('[data-next-checkout-field="email"]', 'shopper@example.com');
  await page.fill('[data-next-checkout-field="fname"]', 'Ada');
  await page.fill('[data-next-checkout-field="lname"]', 'Lovelace');
  await page.locator('[data-next-checkout-field="lname"]').blur();

  const detail = await created;
  expect(detail.hasCart).toBe(true);
  expect(detail.hasProspectCart).toBe(true);
});
