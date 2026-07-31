import { test, expect, type Page } from '@playwright/test';
import { MINIMAL_CAMPAIGN } from './fixtures/campaign';
import { stubCampaign, stubCart, bootSdk } from './fixtures/routes';

/**
 * E2E for the checkout-form enhancer (`form[data-next-checkout]`).
 *
 * Real payment/tokenization can't run headless, so this covers what is
 * observable without a gateway: the init event, and field-validation classes
 * on blur and on submit. `checkout:form-initialized` fires during the DOM scan
 * before window.next exists, so the fixture buffers it from the shared EventBus.
 *
 * The form's CountryService fetches country/state data from an external CDN;
 * we stub it so the form initializes deterministically offline.
 */

const FIXTURE = '/e2e/fixtures/checkout-form.html';

/** Stub the country/states CDN the checkout form's CountryService calls. */
async function stubCountryService(page: Page): Promise<void> {
  await page.route('**/cdn-countries.muddy-wind-c7ca.workers.dev/**', route => {
    const url = route.request().url();
    if (url.includes('/location')) {
      return route.fulfill({
        json: {
          detectedCountryCode: 'US',
          countries: [
            { code: 'US', name: 'United States' },
            { code: 'CA', name: 'Canada' },
          ],
        },
      });
    }
    // /countries/{code}/states
    return route.fulfill({
      json: {
        countryConfig: {
          stateLabel: 'State',
          stateRequired: true,
          postcodeLabel: 'ZIP Code',
          postcodeRegex: '',
          postcodeExample: '',
          stateExample: '',
        },
        states: [
          { code: 'NY', name: 'New York' },
          { code: 'CA', name: 'California' },
        ],
      },
    });
  });
}

test.beforeEach(async ({ page }) => {
  await stubCampaign(page, MINIMAL_CAMPAIGN);
  await stubCart(page);
  await stubCountryService(page);
});

test('emits checkout:form-initialized {form} on boot', async ({ page }) => {
  await bootSdk(page, FIXTURE);

  const events = await page.evaluate(
    () => (window as any).__capturedEvents['checkout:form-initialized']
  );
  expect(events.length).toBeGreaterThan(0);
  expect(events[0].hasForm).toBe(true);
});

test('an invalid email gets has-error / next-error-field on blur', async ({
  page,
}) => {
  await bootSdk(page, FIXTURE);

  const email = page.locator('[data-next-checkout-field="email"]');
  await email.fill('notanemail');
  await email.blur();

  await expect(email).toHaveClass(/has-error/);
  await expect(email).toHaveClass(/next-error-field/);
});

test('a valid email gets no-error on blur', async ({ page }) => {
  await bootSdk(page, FIXTURE);

  const email = page.locator('[data-next-checkout-field="email"]');
  await email.fill('shopper@example.com');
  await email.blur();

  await expect(email).toHaveClass(/no-error/);
  await expect(email).not.toHaveClass(/has-error/);
});

test('submitting with empty required fields flags them', async ({ page }) => {
  await bootSdk(page, FIXTURE);

  await page.click('button[type="submit"]');

  // Required fields present in the DOM get error classes; a valid field would
  // not. fname/lname/email are all empty required fields here.
  for (const field of ['email', 'fname', 'lname']) {
    const el = page.locator(`[data-next-checkout-field="${field}"]`);
    await expect(el).toHaveClass(/has-error/);
    await expect(el).toHaveClass(/next-error-field/);
  }
});
