import { test, expect } from '@playwright/test';
import { RICH_CAMPAIGN } from './fixtures/campaign';
import { stubCampaign, stubCart, bootSdk } from './fixtures/routes';

/**
 * Behavior-contract regression: swap-mode PackageSelector + AddToCart on the
 * SAME selector.
 *
 * The behavior contract (.claude/skills/sdk-structure/references/
 * behavior-contracts.md, "swap vs select mode") says:
 *   "Do not put swap-mode PackageSelectorEnhancer on a selector that also feeds
 *    an AddToCartEnhancer — the card click and the button each fire a cart
 *    write = double cart writes."
 *
 * FINDING: this contract is an authoring advisory, NOT a runtime guard. The SDK
 * does not dedupe the two writes. Verified against source:
 *   - PackageSelectorEnhancer.syncWithCart auto-adds the pre-selected card on
 *     boot in swap mode (package-selector.enhancer.ts).
 *   - AddToCart's addToCart() calls cartOperations.addItem(), and add-item.ts
 *     INCREMENTS quantity when the package is already present
 *     (existingIndex >= 0 → quantity += ...).
 *
 * So a bound add-to-cart click inflates the quantity of the already-swapped
 * package. This spec locks that ACTUAL behavior: the two features share one
 * package, so the cart never grows a duplicate LINE (itemCount stays 1), but
 * the quantity IS double-written (totalQuantity climbs past 1) — which is
 * exactly the hazard the contract warns against. If a future change adds a
 * runtime guard, this test will flag the behavior change for review.
 */

const FIXTURE = '/e2e/fixtures/conflict-guard.html';

test.beforeEach(async ({ page }) => {
  await stubCampaign(page, RICH_CAMPAIGN);
  await stubCart(page);
});

const totalQuantity = (page: import('@playwright/test').Page) =>
  page.locator('[data-next-display="cart.totalQuantity"]');
const itemCount = (page: import('@playwright/test').Page) =>
  page.locator('[data-next-display="cart.itemCount"]');

test('swap auto-add on boot yields exactly one line of quantity one', async ({
  page,
}) => {
  await bootSdk(page, FIXTURE);

  // Swap mode auto-adds the pre-selected card exactly once.
  await expect(totalQuantity(page)).toHaveText('1');
  await expect(itemCount(page)).toHaveText('1');
});

test('a bound add-to-cart click never creates a duplicate line', async ({
  page,
}) => {
  await bootSdk(page, FIXTURE);
  await expect(totalQuantity(page)).toHaveText('1');

  await page.click('[data-next-action="add-to-cart"]');

  // The button and the selector target the same package, so the cart keeps a
  // single line — no duplicate row is ever created.
  await expect(itemCount(page)).toHaveText('1');

  // Documented hazard: the add-to-cart click is a SECOND cart write on top of
  // the swap auto-add, so the quantity is inflated rather than staying at 1.
  // This is why the contract forbids pairing the two on one selector.
  await expect(totalQuantity(page)).not.toHaveText('1');
  await expect
    .poll(async () =>
      Number(await totalQuantity(page).textContent())
    )
    .toBeGreaterThan(1);
});
