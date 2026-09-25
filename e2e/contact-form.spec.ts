import { test, expect, type Page } from '@playwright/test';
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
import { CHECKOUT_KEY } from './fixtures/storage-keys';

/**
 * `data-next-contact`: the name, email and phone rows a country asks for, built from its
 * rules the way `data-next-address` builds the address rows. Proved here: the rows follow
 * the country (Japan writes the family name first), the fields are real checkout fields
 * the form validates and stores, and no field is built twice: not one the page writes,
 * and not one a shipping address beside it lays out.
 *
 * Why not a unit test: the renderer has one. What it cannot prove is the blocks and the
 * checkout form meeting on a live page, which is where every address-block defect lived.
 */

const FIXTURE = '/e2e/fixtures/contact-form.html';
const FIELD = (name: string) => `[data-next-checkout-field="${name}"]`;
const SHIPPING_BLOCK = '<div data-next-address="shipping"></div>';

const contactFields = {
  first_name: ruleField('First name', 'given-name'),
  last_name: ruleField('Last name', 'family-name'),
  email: ruleField('Email', 'email', { type: 'email', inputMode: 'email' }),
  phone_number: ruleField(
    'Phone number',
    'tel',
    { type: 'tel' },
    { required: false }
  ),
};
const addressFields = {
  country: ruleField('Country', 'country', {
    type: 'select',
    options: 'countries',
  }),
  line1: ruleField('Address', 'address-line1'),
};

const US = countryRules(
  'US',
  [['country'], ['first_name', 'last_name'], ['line1'], ['phone_number']],
  { ...contactFields, ...addressFields }
);
const JP = countryRules(
  'JP',
  [['country'], ['last_name', 'first_name'], ['line1'], ['phone_number']],
  { ...contactFields, ...addressFields }
);

let escaped: string[] = [];
/** Which of the two blocks' requests is held back, to make it answer last. */
let held: number | undefined;

test.beforeEach(async ({ page }) => {
  escaped = await blockLiveNetwork(page);
  held = undefined;
  let calls = 0;
  await stubCampaign(page, MINIMAL_CAMPAIGN);
  await stubCart(page);
  await routeAddressService(page, {
    countries: [
      { code: 'US', name: 'United States' },
      { code: 'JP', name: 'Japan' },
    ],
    rules: async (code, { withStates }) => {
      // The blocks ask without states; the checkout form asks with them.
      if (!withStates && calls++ === held) {
        await new Promise(resolve => setTimeout(resolve, 300));
      }
      return code === 'JP' ? JP : US;
    },
  });
});

test.afterEach(() => {
  expect(escaped, 'requests no stub answered').toEqual([]);
});

const fieldsIn = (page: Page, block: string) =>
  page
    .locator(`${block} [data-next-checkout-field]`)
    .evaluateAll(els =>
      els.map(el => el.getAttribute('data-next-checkout-field'))
    );

/** Serves the fixture with its shipping block replaced by `markup`. */
async function replaceShippingBlock(page: Page, markup: string): Promise<void> {
  await page.route('**/e2e/fixtures/contact-form.html', async route => {
    const response = await route.fetch();
    const body = (await response.text()).replace(SHIPPING_BLOCK, markup);
    await route.fulfill({ response, body });
  });
}

test('builds the name, email and phone rows, and the form reads them', async ({
  page,
}) => {
  await replaceShippingBlock(page, '');
  await bootSdk(page, FIXTURE);

  await expect
    .poll(() => fieldsIn(page, '[data-next-contact]'))
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

/**
 * The names and the phone are in both layouts. Beside a shipping address the address
 * builds them, whichever block answers first: a rule decided by arrival order leaves the
 * name in the contact rows on one visit and in the address on the next.
 */
for (const [order, hold] of [
  ['the contact rows answer last', 0],
  ['the address answers last', 1],
] as const) {
  test(`beside a shipping address the contact rows keep only the email, when ${order}`, async ({
    page,
  }) => {
    held = hold;
    await bootSdk(page, FIXTURE);

    await expect
      .poll(() => fieldsIn(page, '[data-next-address]'))
      .toEqual(['country', 'fname', 'lname', 'address1', 'phone']);
    await expect
      .poll(() => fieldsIn(page, '[data-next-contact]'))
      .toEqual(['email']);
    await expect(page.locator(FIELD('fname'))).toHaveCount(1);
    await expect(page.locator(FIELD('phone'))).toHaveCount(1);
  });
}

/** The negative control: a billing address is not where the shopper's own name goes. */
test('beside only a billing address the contact rows are whole', async ({
  page,
}) => {
  await replaceShippingBlock(page, '<div data-next-address="billing"></div>');
  await bootSdk(page, FIXTURE);

  await expect
    .poll(() => fieldsIn(page, '[data-next-contact]'))
    .toEqual(['fname', 'lname', 'email', 'phone']);
  await expect
    .poll(() => fieldsIn(page, '[data-next-address]'))
    .toEqual([
      'billing-country',
      'billing-fname',
      'billing-lname',
      'billing-address1',
      'billing-phone',
    ]);
});

/**
 * The service serves no contact rows: they are read off the address layout, so a contact
 * block alone writes the name as the country's address does.
 */
test('alone, writes the name in the order the country writes an address', async ({
  page,
}) => {
  // No country select on this page: the form's country is the one it restored.
  await page.addInitScript(key => {
    sessionStorage.setItem(
      key,
      JSON.stringify({ state: { formData: { country: 'JP' } }, version: 0 })
    );
  }, CHECKOUT_KEY);
  await replaceShippingBlock(page, '');
  await bootSdk(page, FIXTURE);

  await expect
    .poll(() => fieldsIn(page, '[data-next-contact]'))
    .toEqual(['lname', 'fname', 'email', 'phone']);
});

test('writes the family name first where the country does, and keeps what was typed', async ({
  page,
}) => {
  await bootSdk(page, FIXTURE);
  await expect
    .poll(() => fieldsIn(page, '[data-next-address]'))
    .toEqual(['country', 'fname', 'lname', 'address1', 'phone']);
  await page.locator(FIELD('fname')).fill('Ada');

  await page.selectOption(FIELD('country'), 'JP');

  await expect
    .poll(() => fieldsIn(page, '[data-next-address]'))
    .toEqual(['country', 'lname', 'fname', 'address1', 'phone']);
  await expect(page.locator(FIELD('fname'))).toHaveValue('Ada');
});

/** The negative control: a field the page writes itself is not built a second time. */
test('builds no field the page already has', async ({ page }) => {
  await replaceShippingBlock(
    page,
    '<input data-next-checkout-field="email" type="email" />'
  );
  await bootSdk(page, FIXTURE);

  await expect
    .poll(() => fieldsIn(page, '[data-next-contact]'))
    .toEqual(['fname', 'lname', 'phone']);
  await expect(page.locator(FIELD('email'))).toHaveCount(1);
});
