import { test, expect, type Page } from '@playwright/test';
import type { CartSummary } from '../src/types/api';
import type { EnrichedCartLine } from '../src/types/global';
import { MINIMAL_CAMPAIGN, RICH_CAMPAIGN } from './fixtures/campaign';
import { stubCampaign, stubCart, bootSdk } from './fixtures/routes';

/**
 * Protects `next.getCartData().cartLines` — the public cart snapshot an
 * integrator reads from the console or a callback (issue #36, reported twice
 * from live pages).
 *
 * A unit test cannot close this hole. The field was empty for every SDK release
 * while the unit suite was green, because it read a store field nothing ever
 * wrote: only booting the real SDK, letting it load a campaign and run the
 * debounced calculate, proves the snapshot a shopper's page actually gets. The
 * reported impact is template and QA code gating on `cartLines.length`, which
 * runs in exactly this position.
 *
 * Fixture: `fixtures/add-to-cart.html` — no markup of its own is needed here
 * beyond one add-to-cart button and a cart display, so this spec reuses it
 * rather than publishing a second copy of the same example.
 */

const FIXTURE = '/e2e/fixtures/add-to-cart.html';

/**
 * The public snapshot's lines, typed as the SDK types them: a local copy of the
 * shape would keep passing after a field on `EnrichedCartLine` was renamed.
 */
const cartLines = (page: Page): Promise<EnrichedCartLine[]> =>
  page.evaluate(() => (window as any).next.getCartData().cartLines);

test('reports no lines while the cart is empty', async ({ page }) => {
  await stubCampaign(page, MINIMAL_CAMPAIGN);
  await stubCart(page);
  await bootSdk(page, FIXTURE);

  expect(await cartLines(page)).toEqual([]);
});

test('reports one priced line per added package, and none after a clear', async ({
  page,
}) => {
  // The cart swallows its own failures, so a green assertion below could be the
  // caught-error path — see the sdk-e2e skill §4b.
  const errors: string[] = [];
  page.on('console', m => {
    if (m.type() === 'error') errors.push(m.text());
  });
  page.on('pageerror', e => errors.push(String(e)));

  await stubCampaign(page, MINIMAL_CAMPAIGN);
  await stubCart(page);
  await bootSdk(page, FIXTURE);

  await page.click('[data-next-action="add-to-cart"]');

  await expect.poll(async () => (await cartLines(page)).length).toBe(1);

  const [line] = await cartLines(page);
  expect(line?.packageId).toBe(1);
  expect(line?.quantity).toBe(1);
  expect(line?.product.title).toBe('Widget');
  // MINIMAL_CAMPAIGN's package 1 is $29.99 with no compare-at price.
  expect(line?.price.excl_tax.value).toBe(29.99);
  expect(line?.price.incl_tax.value).toBe(29.99);
  expect(line?.price.original.value).toBe(29.99);
  expect(line?.price.savings.value).toBe(0);
  expect(line?.price.excl_tax.formatted).toMatch(/29\.99/);
  expect(line?.is_upsell).toBe(false);
  expect(line?.is_recurring).toBe(false);

  await page.evaluate(() => (window as any).next.cart.clear());

  await expect.poll(async () => (await cartLines(page)).length).toBe(0);
  expect(errors).toEqual([]);
});

test('prices a line from the calculate API once it answers', async ({
  page,
}) => {
  // Package 1 at $29.99 list, discounted to $24.99 by the API.
  const summary: CartSummary = {
    lines: [
      {
        package_id: 1,
        quantity: 1,
        discounts: [],
        original_unit_price: '29.99',
        original_package_price: '29.99',
        unit_price: '24.99',
        package_price: '24.99',
        subtotal: '29.99',
        total_discount: '5.00',
        total: '24.99',
      },
    ],
    shipping_method: {
      id: 0,
      name: 'Standard',
      code: 'standard',
      original_price: '0.00',
      price: '0.00',
      discounts: [],
    },
    offer_discounts: [],
    voucher_discounts: [],
    subtotal: '29.99',
    total_discount: '5.00',
    total: '24.99',
    currency: 'USD',
  };

  await stubCampaign(page, MINIMAL_CAMPAIGN);
  await stubCart(page, summary);
  await bootSdk(page, FIXTURE);

  await page.click('[data-next-action="add-to-cart"]');

  // The line total comes from the API response, and the $5.00 it took off shows
  // up as savings against the package's original price.
  await expect
    .poll(async () => (await cartLines(page))[0]?.price.excl_tax.value)
    .toBe(24.99);
  const [line] = await cartLines(page);
  expect(line?.price.original.value).toBe(29.99);
  expect(line?.price.savings.value).toBe(5);
});

test('reports compare-at savings from the campaign retail price', async ({
  page,
}) => {
  await stubCampaign(page, RICH_CAMPAIGN);
  await stubCart(page);
  await bootSdk(page, FIXTURE);

  // RICH_CAMPAIGN package 2: three units at $74.97, retail $119.97.
  await page.evaluate(() =>
    (window as any).next.addItem({ packageId: 2, quantity: 1 })
  );

  await expect.poll(async () => (await cartLines(page)).length).toBe(1);

  const [line] = await cartLines(page);
  expect(line?.price.excl_tax.value).toBe(74.97);
  expect(line?.price.original.value).toBe(119.97);
  // 119.97 − 74.97 is exact in IEEE 754, so pin it: toBeCloseTo would also pass
  // a wrongly rounded 45.004.
  expect(line?.price.savings.value).toBe(45);
});
