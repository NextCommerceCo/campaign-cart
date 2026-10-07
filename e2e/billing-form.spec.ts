import { test, expect } from '@playwright/test';
import { MINIMAL_CAMPAIGN } from './fixtures/campaign';
import {
  stubCampaign,
  stubCart,
  bootSdk,
  routeAddressService,
  countryRules,
  ruleField,
} from './fixtures/routes';

/**
 * E2E for the billing form the checkout form clones from a hand-written shipping form.
 *
 * Only a browser runs the clone, the toggle's timers and the province refill together.
 * Rebuilding the billing province list wrote nothing to the store, so the province
 * pre-selected from shipping showed on screen while submit reported it missing.
 */

const FIXTURE = '/e2e/fixtures/billing-form.html';
const FIELD = (name: string) => `[data-next-checkout-field="${name}"]`;

const US_RULES = countryRules(
  'US',
  [['country'], ['line1'], ['city', 'state', 'postcode']],
  {
    state: ruleField('State', 'address-level1', {
      type: 'select',
      options: 'states',
    }),
    postcode: ruleField('ZIP Code', 'postal-code'),
  }
);

test.beforeEach(async ({ page }) => {
  await stubCampaign(page, MINIMAL_CAMPAIGN);
  await stubCart(page);
  await routeAddressService(page, {
    countries: [{ code: 'US', name: 'United States' }],
    rules: () => ({
      ...US_RULES,
      states: [
        { code: 'CA', name: 'California' },
        { code: 'NY', name: 'New York' },
      ],
    }),
  });
});

test('a billing province pre-selected from shipping is the one submit reads', async ({
  page,
}) => {
  await bootSdk(page, FIXTURE);
  await page.fill(FIELD('address1'), '1 Main St');
  await page.selectOption(FIELD('province'), 'NY');

  await page.uncheck('input[name="use_shipping_address"]');
  await expect(page.locator(FIELD('billing-province'))).toHaveValue('NY');
  await page.fill(FIELD('billing-fname'), 'Ada');
  await page.fill(FIELD('billing-lname'), 'Lovelace');
  await page.fill(FIELD('billing-address1'), '14 Billing Way');
  await page.fill(FIELD('billing-city'), 'Albany');
  await page.fill(FIELD('billing-postal'), '12207');
  await page.click('button[type="submit"]');
  // Submit has run once the empty email is marked.
  await expect(page.locator(FIELD('email'))).toHaveClass(/next-error-field/);

  await expect(page.locator(FIELD('billing-province'))).toHaveValue('NY');
  await expect(page.locator(FIELD('billing-province'))).not.toHaveClass(
    /next-error-field/
  );
});

test('a billing province left on its prompt is still refused', async ({
  page,
}) => {
  await bootSdk(page, FIXTURE);

  await page.uncheck('input[name="use_shipping_address"]');
  await expect(page.locator(FIELD('billing-province'))).toHaveValue('');
  await page.fill(FIELD('billing-address1'), '14 Billing Way');
  await page.click('button[type="submit"]');
  await expect(page.locator(FIELD('email'))).toHaveClass(/next-error-field/);

  await expect(page.locator(FIELD('billing-province'))).toHaveClass(
    /next-error-field/
  );
});
