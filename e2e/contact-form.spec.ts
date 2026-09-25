import { test, expect } from '@playwright/test';
import { MINIMAL_CAMPAIGN } from './fixtures/campaign';
import {
  blockLiveNetwork,
  bootSdk,
  countryRules,
  routeAddressService,
  ruleField,
  stubCampaign,
  stubCart,
} from './fixtures/routes';

/**
 * `data-next-contact`: the name, email and phone rows a country asks for, built from its
 * rules the way `data-next-address` builds the address rows. Proved here: the rows follow
 * the country (Japan writes the family name first), the fields are real checkout fields
 * the form validates and stores, and a field the page writes itself is not built again.
 *
 * Why not a unit test: the renderer has one. What it cannot prove is the block and the
 * checkout form meeting on a live page, which is where every address-block defect lived.
 */

const FIXTURE = '/e2e/fixtures/contact-form.html';
const FIELD = (name: string) => `[data-next-checkout-field="${name}"]`;

const contactFields = {
  first_name: ruleField('First name', 'given-name'),
  last_name: ruleField('Last name', 'family-name'),
  email: ruleField('Email', 'email', { type: 'email', inputMode: 'email' }),
  phone: ruleField('Phone number', 'tel', { type: 'tel' }, { required: false }),
};
const addressFields = {
  country: ruleField('Country', 'country', {
    type: 'select',
    options: 'countries',
  }),
  line1: ruleField('Address', 'address-line1'),
};

const US = countryRules('US', [['country'], ['line1']], {
  ...contactFields,
  ...addressFields,
});
const JP = countryRules(
  'JP',
  [['country'], ['line1']],
  { ...contactFields, ...addressFields },
  { contact: { layout: [['last_name', 'first_name'], ['email'], ['phone']] } }
);

let escaped: string[] = [];

test.beforeEach(async ({ page }) => {
  escaped = await blockLiveNetwork(page);
  await stubCampaign(page, MINIMAL_CAMPAIGN);
  await stubCart(page);
  await routeAddressService(page, {
    countries: [
      { code: 'US', name: 'United States' },
      { code: 'JP', name: 'Japan' },
    ],
    rules: code => (code === 'JP' ? JP : US),
  });
});

test.afterEach(() => {
  expect(escaped, 'requests no stub answered').toEqual([]);
});

const contactOrder = (page: import('@playwright/test').Page) =>
  page
    .locator('[data-next-contact] [data-next-checkout-field]')
    .evaluateAll(els =>
      els.map(el => el.getAttribute('data-next-checkout-field'))
    );

test('builds the name, email and phone rows, and the form reads them', async ({
  page,
}) => {
  await bootSdk(page, FIXTURE);

  await expect
    .poll(() => contactOrder(page))
    .toEqual(['fname', 'lname', 'email', 'phone']);
  await expect(page.locator(FIELD('email'))).toHaveAttribute('type', 'email');
  await expect(page.locator(FIELD('phone'))).toHaveAttribute('type', 'tel');
  await expect(page.locator('[data-next-contact]')).toHaveAttribute(
    'data-next-contact-state',
    'ready'
  );

  // A real checkout field: the form validates it as the shopper leaves it.
  await page.locator(FIELD('email')).fill('not-an-email');
  await page.locator(FIELD('email')).blur();
  await expect(page.locator(FIELD('email'))).toHaveClass(/has-error/);
});

test('writes the family name first where the country does, and keeps what was typed', async ({
  page,
}) => {
  await bootSdk(page, FIXTURE);
  await expect
    .poll(() => contactOrder(page))
    .toEqual(['fname', 'lname', 'email', 'phone']);
  await page.locator(FIELD('fname')).fill('Ada');

  await page.selectOption(FIELD('country'), 'JP');

  await expect
    .poll(() => contactOrder(page))
    .toEqual(['lname', 'fname', 'email', 'phone']);
  await expect(page.locator(FIELD('fname'))).toHaveValue('Ada');
});

/** The negative control: a field the page writes itself is not built a second time. */
test('builds no field the page already has', async ({ page }) => {
  await page.route('**/e2e/fixtures/contact-form.html', async route => {
    const response = await route.fetch();
    const body = (await response.text()).replace(
      '<div data-next-contact></div>',
      '<input data-next-checkout-field="email" type="email" /><div data-next-contact></div>'
    );
    await route.fulfill({ response, body });
  });
  await bootSdk(page, FIXTURE);

  await expect
    .poll(() => contactOrder(page))
    .toEqual(['fname', 'lname', 'phone']);
  await expect(page.locator(FIELD('email'))).toHaveCount(1);
});
