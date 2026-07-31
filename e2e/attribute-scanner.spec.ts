import { test, expect } from '@playwright/test';
import { MINIMAL_CAMPAIGN } from './fixtures/campaign';
import { stubCampaign, stubCart, bootSdk } from './fixtures/routes';

/**
 * AttributeScanner: instantiates enhancers for `data-next-*` elements on the
 * initial scan and — via its DOMObserver — for nodes added afterwards, and
 * tears them down when their element is removed.
 *
 * Note: the DOMObserver only reacts to a fixed attributeFilter that includes
 * `data-next-display` but NOT `data-next-action`, so dynamic-node coverage uses
 * a display element (a dynamically injected add-to-cart button would not be
 * picked up — see src/core/base/dom-observer.ts attributeFilter).
 */

const FIXTURE = '/e2e/fixtures/attribute-scanner.html';

test.beforeEach(async ({ page }) => {
  await stubCampaign(page, MINIMAL_CAMPAIGN);
  await stubCart(page);
});

test('enhances the statically present data-next-* elements', async ({
  page,
}) => {
  // Capture the display-ready detail via an init script (it fires during boot,
  // before window.next exists, so a post-goto listener would miss it).
  await page.addInitScript(() => {
    (window as any).__ready = null;
    window.addEventListener('next:display-ready', (e: any) => {
      (window as any).__ready = e.detail;
    });
  });

  await bootSdk(page, FIXTURE);

  // The scan reported at least one enhanced element.
  const detail = await page.evaluate(() => (window as any).__ready);
  expect(detail.enhancedCount).toBeGreaterThan(0);

  // The display enhancer bound and the action enhancer works: clicking the
  // add-to-cart button updates the cart display.
  await page.click('[data-next-action="add-to-cart"]');
  await expect(
    page.locator('[data-next-display="cart.totalQuantity"]')
  ).toHaveText('1');
});

test('enhances a dynamically injected display node (DOMObserver)', async ({
  page,
}) => {
  await bootSdk(page, FIXTURE);

  // Put an item in the cart first so the freshly-enhanced display has a
  // non-zero value to render (proving it actually bound to the store).
  await page.click('[data-next-action="add-to-cart"]');
  await expect(
    page.locator('[data-next-display="cart.totalQuantity"]')
  ).toHaveText('1');

  // Inject a new cart display after boot.
  await page.evaluate(() => {
    document
      .getElementById('dynamic-host')!
      .insertAdjacentHTML(
        'beforeend',
        '<span id="injected" data-next-display="cart.totalQuantity">pending</span>'
      );
  });

  // The DOMObserver (throttle ~16ms) → scanner queue (debounce 50ms) enhances
  // it; once enhanced it renders the current quantity.
  await expect(page.locator('#injected')).toHaveText('1', { timeout: 5000 });
});

test('removing an enhanced node cleans it up without errors', async ({
  page,
}) => {
  const pageErrors: string[] = [];
  page.on('pageerror', e => pageErrors.push(e.message));

  await bootSdk(page, FIXTURE);
  await expect(page.locator('html')).toHaveClass(/next-display-ready/);

  // Remove an enhanced element; the scanner's DOMObserver should tear its
  // enhancer down. This must not throw.
  await page.evaluate(() => {
    document.querySelector('[data-next-display="cart.totalQuantity"]')?.remove();
  });

  // Give the observer a tick, then confirm the SDK is still healthy.
  await page.waitForTimeout(100);
  const alive = await page.evaluate(
    () => Boolean((window as any).next?.getCampaignData())
  );
  expect(alive).toBe(true);
  expect(pageErrors).toEqual([]);
});
