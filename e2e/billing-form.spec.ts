import { test, expect, type Page } from '@playwright/test';
import { MINIMAL_CAMPAIGN } from './fixtures/campaign';
import {
  stubCampaign,
  stubCart,
  bootSdk,
  routeAddressService,
  countryRules,
  ruleField,
} from './fixtures/routes';
import { CHECKOUT_KEY } from './fixtures/storage-keys';

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

/** The first step of a multi-step checkout, where the billing address is chosen. */
const STEP_FIXTURE = '/e2e/fixtures/billing-form-step.html';

async function fillShipping(page: Page): Promise<void> {
  await page.fill(FIELD('email'), 'ada@example.test');
  await page.fill(FIELD('fname'), 'Ada');
  await page.fill(FIELD('lname'), 'Lovelace');
  await page.fill(FIELD('address1'), '1 Main St');
  await page.fill(FIELD('city'), 'New York');
  await page.selectOption(FIELD('province'), 'NY');
  await page.fill(FIELD('postal'), '10001');
}

/**
 * A billing address chosen on step 1 was first checked on the payment page, which has no
 * billing fields, so the shopper moved on with it blank and met a pay button that did
 * nothing they could see.
 */
test('a blank billing address stops the shopper on the step that holds it', async ({
  page,
}) => {
  await bootSdk(page, STEP_FIXTURE);
  await fillShipping(page);
  await page.uncheck('input[name="use_shipping_address"]');
  await expect(page.locator(FIELD('billing-fname'))).toBeVisible();

  await page.click('button[type="submit"]');

  await expect(page.locator(FIELD('billing-fname'))).toHaveClass(
    /next-error-field/
  );
  await expect(page).toHaveURL(/billing-form-step\.html/);
});

test('a shopper billing to the shipping address moves on', async ({ page }) => {
  await bootSdk(page, STEP_FIXTURE);
  await fillShipping(page);

  await page.click('button[type="submit"]');

  await page.waitForURL(/checkout-form\.html/);
});

/**
 * A billing section open at boot (a returning shopper who chose a separate billing
 * address and typed none of it yet) showed a country the store never held: the choice was
 * dispatched as a `change` before the form listened for one.
 */
test('a billing section open at boot stores the country its dropdown shows', async ({
  page,
}) => {
  await page.addInitScript(key => {
    sessionStorage.setItem(
      key,
      JSON.stringify({ state: { sameAsShipping: false }, version: 0 })
    );
  }, CHECKOUT_KEY);
  await bootSdk(page, FIXTURE);
  await expect(
    page.locator('input[name="use_shipping_address"]')
  ).not.toBeChecked();

  await expect(page.locator(FIELD('billing-country'))).toHaveValue('US');
  await expect
    .poll(() =>
      page.evaluate(key => {
        const raw = sessionStorage.getItem(key);
        return raw
          ? (
              JSON.parse(raw) as {
                state?: { billingAddress?: { country?: string } };
              }
            ).state?.billingAddress?.country
          : undefined;
      }, CHECKOUT_KEY)
    )
    .toBe('US');
  await expect(
    page.locator(`${FIELD('billing-province')} option[value="NY"]`)
  ).toHaveCount(1);
});

/**
 * Clicks the billing toggle until the click holds: one made while the section is still
 * animating is reverted on purpose.
 */
async function setSameAsShipping(page: Page, same: boolean): Promise<void> {
  const toggle = page.locator('input[name="use_shipping_address"]');
  await expect(() => toggle.setChecked(same, { timeout: 500 })).toPass();
}

/**
 * Reopening the billing section emptied the stored address and left the fields filled,
 * so submit reported every one of them missing under the value it showed.
 */
test('a billing address typed, closed and reopened is the one submit reads', async ({
  page,
}) => {
  await bootSdk(page, FIXTURE);
  await setSameAsShipping(page, false);
  await page.fill(FIELD('billing-fname'), 'Ada');
  await page.fill(FIELD('billing-lname'), 'Lovelace');
  await page.fill(FIELD('billing-address1'), '14 Billing Way');
  await page.fill(FIELD('billing-city'), 'Albany');
  await page.selectOption(FIELD('billing-province'), 'NY');
  await page.fill(FIELD('billing-postal'), '12207');

  await setSameAsShipping(page, true);
  await setSameAsShipping(page, false);
  await page.click('button[type="submit"]');
  await expect(page.locator(FIELD('email'))).toHaveClass(/next-error-field/);

  await expect(page.locator(FIELD('billing-fname'))).toHaveValue('Ada');
  for (const name of ['billing-fname', 'billing-address1', 'billing-postal']) {
    await expect(page.locator(FIELD(name))).not.toHaveClass(/next-error-field/);
  }
});

/**
 * Countries answer in any order. A slow one used to land last and win: the provinces of a
 * country the shopper had already moved off, under a dropdown naming the new one.
 */
test('the province list is the country chosen last, whichever answer arrives last', async ({
  page,
}) => {
  await routeAddressService(page, {
    countries: [
      { code: 'CA', name: 'Canada' },
      { code: 'US', name: 'United States' },
    ],
    rules: async code => {
      if (code === 'CA') {
        await new Promise(resolve => setTimeout(resolve, 800));
        return { ...US_RULES, states: [{ code: 'ON', name: 'Ontario' }] };
      }
      return { ...US_RULES, states: [{ code: 'NY', name: 'New York' }] };
    },
  });
  await bootSdk(page, FIXTURE);
  await page.fill(FIELD('address1'), '1 Main St');

  await page.selectOption(FIELD('country'), 'CA');
  await page.selectOption(FIELD('country'), 'US');
  // Well after the Canadian answer has arrived.
  await page.waitForTimeout(1500);

  await expect(page.locator(FIELD('country'))).toHaveValue('US');
  await expect(
    page.locator(`${FIELD('province')} option[value="NY"]`)
  ).toHaveCount(1);
  await expect(
    page.locator(`${FIELD('province')} option[value="ON"]`)
  ).toHaveCount(0);
});

/**
 * Thai, Lao, Khmer and every Indic script write vowels and tones as combining marks,
 * which the name and city checks refused: a shopper named สุดา, or living in เชียงใหม่,
 * could not pay. A Thai name with no such mark (สมชาย) always passed.
 */
test('names and cities written with Thai vowel marks are accepted on both addresses', async ({
  page,
}) => {
  await bootSdk(page, FIXTURE);
  await page.fill(FIELD('fname'), 'สุดา');
  await page.fill(FIELD('lname'), 'ใจดี');
  await page.fill(FIELD('address1'), '1 ถนนนิมมานเหมินท์');
  await page.fill(FIELD('city'), 'เชียงใหม่');
  await setSameAsShipping(page, false);
  await page.fill(FIELD('billing-fname'), 'ประยุทธ์');
  await page.fill(FIELD('billing-address1'), '2 ถนนสุขุมวิท');
  await page.fill(FIELD('billing-city'), 'กรุงเทพมหานคร');
  await page.locator(FIELD('billing-city')).blur();

  await page.click('button[type="submit"]');
  await expect(page.locator(FIELD('email'))).toHaveClass(/next-error-field/);

  for (const name of [
    'fname',
    'lname',
    'city',
    'billing-fname',
    'billing-city',
  ]) {
    await expect(page.locator(FIELD(name))).not.toHaveClass(/next-error-field/);
  }
});
