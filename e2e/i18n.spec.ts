import { test, expect, type Page } from '@playwright/test';
import { MINIMAL_CAMPAIGN } from './fixtures/campaign';
import {
  blockLiveNetwork,
  bootSdk,
  countryRules,
  routeAddressService,
  stubCampaign,
  stubCart,
} from './fixtures/routes';

/**
 * `data-next-i18n`: an element's text and attributes, translated by key into the page's
 * language, from the page's `nextConfig.translations` and then the address-rules
 * service's texts. Proved here: both sources reach the page, a key neither has leaves
 * the page's own text, an element with children keeps them, and an attribute outside the
 * allowed four is never written.
 *
 * Why not a unit test: the lookup and the writer have one each. What they cannot prove is
 * the scanner activating the element, and the service's texts, which arrive after boot,
 * repainting what was already translated.
 */

const FIXTURE = '/e2e/fixtures/i18n.html';
const baseOf = (lang: string) => lang.split('-')[0] ?? lang;

const SERVICE_TEXTS: Record<string, Record<string, string>> = {
  th: {
    'checkout.contact.title': 'ข้อมูลติดต่อ',
    'page.link': 'javascript:alert(1)',
  },
};

let escaped: string[] = [];

test.beforeEach(async ({ page }) => {
  escaped = await blockLiveNetwork(page);
  await stubCampaign(page, MINIMAL_CAMPAIGN);
  await stubCart(page);
  await routeAddressService(page, {
    countries: [{ code: 'US', name: 'United States' }],
    // The service answers `th-TH` in `th`, and says so; the SDK uses its texts only for
    // a page in the language they came back in.
    rules: (code, { lang }) => ({
      ...countryRules(code, [['country'], ['line1']], {}),
      lang: baseOf(lang),
    }),
    locale: lang => SERVICE_TEXTS[baseOf(lang)],
  });
});

test.afterEach(() => {
  expect(escaped, 'requests no stub answered').toEqual([]);
});

async function withConfig(
  page: Page,
  config: Record<string, unknown>
): Promise<void> {
  await page.addInitScript(value => {
    (window as any).nextConfig = value;
  }, config);
}

test("translates from the page's translations and the service's texts", async ({
  page,
}) => {
  await withConfig(page, {
    locale: 'th-TH',
    translations: {
      th: {
        'checkout.contact.subtitle': 'เราจะส่งใบเสร็จไปที่อีเมลนี้',
        'checkout.pay': 'ชำระเงิน',
        'checkout.pay.aria': 'ชำระเงินตอนนี้',
        'page.search': 'ค้นหา',
      },
    },
  });
  const errors: string[] = [];
  page.on('console', m => {
    if (m.type() === 'error') errors.push(m.text());
  });
  page.on('pageerror', e => errors.push(String(e)));
  await bootSdk(page, FIXTURE);

  // From the service, which answers after boot.
  await expect(page.locator('#title')).toHaveText('ข้อมูลติดต่อ');
  // From the page.
  await expect(page.locator('#subtitle')).toHaveText(
    'เราจะส่งใบเสร็จไปที่อีเมลนี้'
  );
  await expect(page.locator('#pay')).toHaveText('ชำระเงิน');
  await expect(page.locator('#pay')).toHaveAttribute(
    'aria-label',
    'ชำระเงินตอนนี้'
  );
  await expect(page.locator('#search')).toHaveAttribute('placeholder', 'ค้นหา');
  expect(errors).toEqual([]);
});

/** The negative controls: what must not be written. */
/**
 * A language chosen after boot: the service's texts for it arrive after the switch has
 * already repainted the page, so the page has to be translated again when they land.
 */
test("repaints when the service's texts for a new language arrive", async ({
  page,
}) => {
  await bootSdk(page, `${FIXTURE}?debugger=true`);
  await expect(page.locator('#title')).toHaveText('Contact');

  await page
    .locator('#debug-locale-selector #locale-select')
    .selectOption('th-TH');

  await expect(page.locator('#title')).toHaveText('ข้อมูลติดต่อ');
});

test('never writes an attribute outside the four, nor over child elements', async ({
  page,
}) => {
  await withConfig(page, {
    locale: 'th-TH',
    translations: {
      th: { 'checkout.pay': 'ชำระเงิน', 'page.search': 'ค้นหา' },
    },
  });
  await bootSdk(page, FIXTURE);

  await expect(page.locator('#search')).toHaveAttribute('placeholder', 'ค้นหา');
  await expect(page.locator('#search')).not.toHaveAttribute('href', /.*/);
  await expect(page.locator('#icon svg')).toHaveCount(1);
  await expect(page.locator('#icon')).toHaveText('Pay');
});

test("keeps the page's own text in a language nothing translates", async ({
  page,
}) => {
  await withConfig(page, {
    locale: 'de-DE',
    translations: { th: { 'checkout.pay': 'ชำระเงิน' } },
  });
  // Past the service's texts, the last thing that could repaint.
  const texts = page.waitForResponse(r => r.url().includes('/v1/locales/'));
  await bootSdk(page, FIXTURE);
  await texts;

  await expect(page.locator('#title')).toHaveText('Contact');
  await expect(page.locator('#pay')).toHaveText('Pay');
  await expect(page.locator('#pay')).toHaveAttribute('aria-label', 'Pay now');
  await expect(page.locator('#search')).toHaveAttribute(
    'placeholder',
    'Search'
  );
});
