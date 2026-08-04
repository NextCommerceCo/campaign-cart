import { test, expect, type Page } from '@playwright/test';
import type { Campaign } from '../src/types/campaign';
import { MINIMAL_CAMPAIGN } from './fixtures/campaign';
import { stubCampaign, stubCart, bootSdk } from './fixtures/routes';

/**
 * E2E for how prices are *written* — issue #46, "no way to display prices for
 * standard European markets".
 *
 * The currency code does not decide the decimal separator or which side the symbol
 * sits on; the **locale** does. The same EUR amount is `€29.99` under `en-US` and
 * `29,99 €` under `de-DE`. These specs pin both inputs — the browser locale through
 * Playwright's context `locale`, and the campaign's own choice through
 * `window.nextConfig.locale` — and assert the rendered text.
 *
 * Why this is E2E and not a unit test: `currency-formatter.test.ts` already proves
 * the formatter in isolation. What only a browser can prove is that the value
 * reaches the DOM through a real enhancer, that a real `navigator.language` feeds
 * it, and that the debug picker's re-render actually repaints the page.
 */

const FIXTURE = '/e2e/fixtures/locale.html';

/** MINIMAL_CAMPAIGN prices package 1 at 29.99; this sells it in euros. */
const EUR_CAMPAIGN: Campaign = { ...MINIMAL_CAMPAIGN, currency: 'EUR' };

async function stubEurCampaign(page: Page): Promise<void> {
  await stubCampaign(page, EUR_CAMPAIGN);
  await stubCart(page);
}

/** Pins `window.nextConfig` before any SDK code runs. */
async function pinConfig(page: Page, config: Record<string, unknown>) {
  await page.addInitScript(cfg => {
    (window as unknown as Record<string, unknown>).nextConfig = cfg;
  }, config);
}

/**
 * German output uses a narrow no-break space (U+202F) between number and symbol,
 * which `toHaveText('29,99 €')` with an ASCII space would fail on. Assert the two
 * things that actually distinguish the formats instead.
 */
const GERMAN_PRICE = /^29,99\s€$/u;
const US_PRICE = /^€29\.99$/u;

test.describe('browser locale decides the format by default', () => {
  test.use({ locale: 'de-DE' });

  test('a German browser already gets German formatting, with no config at all', async ({
    page,
  }) => {
    // masmalsah's point on the issue: for a real in-country shopper this already
    // worked. The gap the `locale` option fills is *pinning*, not the default.
    await stubEurCampaign(page);
    await bootSdk(page, FIXTURE);

    await expect(page.locator('#price')).toHaveText(GERMAN_PRICE);
  });
});

test.describe('with an en-US browser', () => {
  test.use({ locale: 'en-US' });

  test('renders the US format when nothing is pinned', async ({ page }) => {
    await stubEurCampaign(page);
    await bootSdk(page, FIXTURE);

    await expect(page.locator('#price')).toHaveText(US_PRICE);
  });

  test('a pinned locale overrides the browser — issue #46', async ({ page }) => {
    await stubEurCampaign(page);
    await pinConfig(page, { locale: 'de-DE' });

    await bootSdk(page, FIXTURE);

    await expect(page.locator('#price')).toHaveText(GERMAN_PRICE);
  });

  test('the pinned locale reaches data-format="number" too', async ({ page }) => {
    // These come from two separately cached formatters. The number one used to be
    // cached without keying on locale, so it could sit on a stale locale while the
    // currency one moved on — one page showing both spellings at once.
    await stubEurCampaign(page);
    await pinConfig(page, { locale: 'de-DE' });

    await bootSdk(page, FIXTURE);

    await expect(page.locator('#price-number')).toHaveText('29,99');
  });

  test('an unparseable locale falls back to the browser instead of breaking prices', async ({
    page,
  }) => {
    // `de_DE` with an underscore is the obvious typo, and `new Intl.NumberFormat`
    // throws on it. Unguarded, that would take out every price on the page, so the
    // real assertion here is that a price still renders at all.
    await stubEurCampaign(page);
    await pinConfig(page, { locale: 'de_DE' });

    await bootSdk(page, FIXTURE);

    await expect(page.locator('#price')).toHaveText(US_PRICE);
  });

  test('the debug locale picker repaints prices without a reload', async ({
    page,
  }) => {
    // Regression: the picker cleared the formatter cache and then announced it on
    // `next:locale-changed`, `next:display-refresh` and a per-element
    // `next:refresh-display` walk — none of which has a listener anywhere in src/.
    // Prices only changed on a manual reload.
    await stubEurCampaign(page);
    await bootSdk(page, `${FIXTURE}?debugger=true`);

    await expect(page.locator('#price')).toHaveText(US_PRICE);

    // The picker lives in an open shadow root, which Playwright locators pierce.
    const picker = page.locator('#debug-locale-selector #locale-select');
    await expect(picker).toBeAttached({ timeout: 10000 });
    await picker.selectOption('de-DE');

    // No page.reload() — that is the whole point.
    await expect(page.locator('#price')).toHaveText(GERMAN_PRICE);
  });
});
