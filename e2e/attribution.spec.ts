import { test, expect } from '@playwright/test';
import { MINIMAL_CAMPAIGN } from './fixtures/campaign';
import { stubCampaign, stubCart, bootSdk } from './fixtures/routes';

/**
 * Attribution: the SDK captures UTM / click params from the landing URL into
 * the attribution store (read back via `window.next.getAttribution()`), and —
 * when UTM-transfer is enabled — copies the current URL params onto on-page
 * links so they carry through to checkout.
 *
 * The fixture enables UTM-transfer via `window.nextConfig.utmTransfer`
 * (src/core/attribution/utm-transfer.ts; wired in sdk-initializer.ts
 * initializeAttribution).
 */

const FIXTURE = '/e2e/fixtures/attribution.html';
const QUERY = '?utm_source=google&utm_medium=cpc&utm_campaign=spring&gclid=abc';

test.beforeEach(async ({ page }) => {
  await stubCampaign(page, MINIMAL_CAMPAIGN);
  await stubCart(page);
});

test('captures UTM and gclid params into the attribution store', async ({
  page,
}) => {
  await bootSdk(page, `${FIXTURE}${QUERY}`);

  const attribution = await page.evaluate(() =>
    (window as any).next.getAttribution()
  );

  expect(attribution.utm_source).toBe('google');
  expect(attribution.utm_medium).toBe('cpc');
  expect(attribution.utm_campaign).toBe('spring');
  expect(attribution.gclid).toBe('abc');
});

test('UTM-transfer decorates on-page links with the current params', async ({
  page,
}) => {
  await bootSdk(page, `${FIXTURE}${QUERY}`);

  // UtmTransfer rewrites the href during the click handler. Cancel the default
  // navigation (added after UtmTransfer's own click listener, so its rewrite
  // has already run) and read the resulting href.
  const href = await page.evaluate(async () => {
    const link = document.getElementById('checkout-link') as HTMLAnchorElement;
    link.addEventListener('click', e => e.preventDefault());
    link.click();
    return link.getAttribute('href');
  });

  expect(href).toContain('utm_source=google');
  expect(href).toContain('utm_medium=cpc');
  expect(href).toContain('gclid=abc');
});
