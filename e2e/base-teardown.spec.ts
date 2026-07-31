import { test, expect } from '@playwright/test';
import { MINIMAL_CAMPAIGN } from './fixtures/campaign';
import { stubCampaign, stubCart, bootSdk } from './fixtures/routes';

/**
 * BaseEnhancer teardown contract: `destroy()` unsubscribes every store
 * subscription registered via `this.subscribe(...)`, so a destroyed enhancer
 * stops reacting to later store changes. See src/core/base/base-enhancer.ts
 * (`subscriptions` + `destroy`).
 *
 * This drives the contract directly by destroying the live enhancer instance,
 * because the scanner's DOMObserver does NOT let a plain node-removal express
 * this cleanly — see the two FINDINGS below.
 *
 * FINDING 1 (re-enhance undoes teardown): removing an enhanced element directly
 * makes the DOMObserver fire `removed` (scanner destroys the enhancer) and then
 * ~16ms later `added` for the SAME node — `addElementForProcessing` pushes
 * removed nodes into `pendingChanges` regardless of type, and `enhanceElement`
 * never checks `isConnected`. The detached node is re-enhanced and re-subscribed,
 * so it keeps updating. (src/core/base/dom-observer.ts addElementForProcessing;
 * src/core/attribute-scanner.ts enhanceElement.)
 *
 * FINDING 2 (container removal never cleans up): removing a PARENT of an
 * enhanced element tears nothing down — the DOMObserver only inspects the
 * removed node's own attributes, not its descendants
 * (dom-observer.ts processChildListMutation removed-node branch).
 */

const FIXTURE = '/e2e/fixtures/base-teardown.html';

test.beforeEach(async ({ page }) => {
  await stubCampaign(page, MINIMAL_CAMPAIGN);
  await stubCart(page);
});

test('destroy() unsubscribes the enhancer from the cart store', async ({
  page,
}) => {
  const pageErrors: string[] = [];
  page.on('pageerror', e => pageErrors.push(e.message));

  await bootSdk(page, FIXTURE);

  // Sanity: the display reacts to the cart while its enhancer is alive.
  await page.click('[data-next-action="add-to-cart"]');
  await expect(page.locator('#qty')).toHaveText('1');

  // Destroy the live enhancer instance bound to #qty (the super.destroy() path
  // the scanner invokes on cleanup) and confirm the subscription is gone.
  const destroyed = await page.evaluate(async () => {
    const mod: any = await import('/src/index.ts');
    const scanner: any = mod.SDKInitializer.getAttributeScanner();
    const el = document.getElementById('qty');
    const enhancers = scanner.enhancers.get(el);
    if (!enhancers || enhancers.length === 0) return false;
    enhancers.forEach((e: any) => e.destroy());
    return true;
  });
  expect(destroyed).toBe(true);

  // Mutate the cart again — quantity goes to 2 in the live store.
  await page.evaluate(() =>
    (window as any).next.cart.addItem({
      packageId: 1,
      quantity: 1,
      isUpsell: false,
    })
  );
  await expect
    .poll(() => page.evaluate(() => (window as any).next.getCartCount()))
    .toBe(2);

  // The destroyed enhancer's element must NOT have updated — subscription torn
  // down by destroy().
  await expect(page.locator('#qty')).toHaveText('1');
  expect(pageErrors).toEqual([]);
});
