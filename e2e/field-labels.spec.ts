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

/**
 * `data-next-label`: fields the page writes itself take their label and placeholder from
 * the country's rules, in the page's language. Proved here: the text follows the country
 * as it changes, an optional field gets its note in the page's language, and a label's
 * own markup survives.
 *
 * Why not only a unit test: `writeFieldLabels` has one. What it cannot prove is the
 * checkout form writing the text as the country changes, from the rules it fetched.
 */

const FIXTURE = '/e2e/fixtures/field-labels.html';
const FIELD = (name: string) => `[data-next-checkout-field="${name}"]`;

let escaped: string[] = [];

function rulesIn(lang: 'en' | 'th', country: 'US' | 'GB') {
  const thai = lang === 'th';
  const postcode = thai
    ? 'รหัสไปรษณีย์'
    : country === 'US'
      ? 'ZIP Code'
      : 'Postcode';
  return countryRules(
    country,
    [['country'], ['postcode']],
    {
      country: ruleField('Country', 'country', {
        type: 'select',
        options: 'countries',
      }),
      postcode: ruleField(postcode, 'postal-code'),
      email: ruleField(thai ? 'อีเมล' : 'Email', 'email', { type: 'email' }),
      phone: ruleField(
        thai ? 'หมายเลขโทรศัพท์' : 'Phone number',
        'tel',
        { type: 'tel' },
        {
          required: false,
        }
      ),
    },
    { lang }
  );
}

async function stub(page: Page): Promise<void> {
  await routeAddressService(page, {
    countries: [
      { code: 'US', name: 'United States' },
      { code: 'GB', name: 'United Kingdom' },
    ],
    rules: (code, { lang }) =>
      rulesIn(lang.startsWith('th') ? 'th' : 'en', code === 'GB' ? 'GB' : 'US'),
    locale: lang =>
      lang.startsWith('th')
        ? { 'field.optional': '{label} (ไม่บังคับ)' }
        : undefined,
  });
}

test.beforeEach(async ({ page }) => {
  escaped = await blockLiveNetwork(page);
  await stubCampaign(page, MINIMAL_CAMPAIGN);
  await stubCart(page);
  await stub(page);
});

test.afterEach(() => {
  expect(escaped, 'requests no stub answered').toEqual([]);
});

test('writes each field’s label and placeholder, and follows the country', async ({
  page,
}) => {
  await bootSdk(page, FIXTURE);

  await expect(
    page.locator('label[for="postal"] [data-next-label-text]')
  ).toHaveText('ZIP Code');
  // The page's own marker stays.
  await expect(page.locator('label[for="postal"]')).toHaveText('ZIP Code *');
  await expect(page.locator(FIELD('email'))).toHaveAttribute(
    'placeholder',
    'Email'
  );
  await expect(page.locator('label[for="phone"]')).toHaveText(
    'Phone number (optional)'
  );

  await page.selectOption(FIELD('country'), 'GB');

  await expect(
    page.locator('label[for="postal"] [data-next-label-text]')
  ).toHaveText('Postcode');
});

test('writes them in the page’s language, note included', async ({ page }) => {
  await page.addInitScript(() => {
    (window as any).nextConfig = { locale: 'th-TH' };
  });
  await bootSdk(page, FIXTURE);

  await expect(page.locator('label[for="email"]')).toHaveText('อีเมล');
  await expect(page.locator(FIELD('phone'))).toHaveAttribute(
    'placeholder',
    'หมายเลขโทรศัพท์ (ไม่บังคับ)'
  );
});
