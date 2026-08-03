import { test, expect, type Page } from '@playwright/test';
import { RICH_CAMPAIGN } from './fixtures/campaign';
import { TEST_ORDER_WITH_UPSELL } from './fixtures/order';
import {
  stubCampaign,
  stubCart,
  stubOrder,
  bootSdk,
  captureEvents,
} from './fixtures/routes';

/**
 * E2E for the post-purchase accept button (`data-next-action="accept-upsell"`).
 *
 * The fixture is loaded with `?ref_id=test-order-ref`, which is how the SDK finds
 * the order to add to — TEST_ORDER has `supports_post_purchase_upsells: true`, so
 * `canAddUpsells()` passes and the buttons enable. Accepting POSTs to
 * `orders/{ref}/upsells/`, stubbed here with the order that already contains the
 * added line (see `stubAcceptUpsell`).
 *
 * Two things worth knowing before editing these tests:
 *
 * - **After a successful accept with no redirect the loading overlay stays up for a
 *   minimum of 3 seconds** (`LoadingOverlay.hide`), covering the whole page.
 *   Playwright waits it out rather than clicking through it, so the test that accepts
 *   twice is slow by design, not flaky.
 * - **The boot-time state of a selector-linked accept button is a race, so nothing
 *   here asserts it.** A `PackageSelectorEnhancer` in upsell context pre-selects a
 *   card while initialising, and the accept button only learns of that selection if it
 *   subscribed first — see `docs/code-findings.md` finding 24. The disabled state is
 *   asserted on a button with no package and no selector, which is deterministic.
 */

const FIXTURE = '/e2e/fixtures/accept-upsell.html?ref_id=test-order-ref';

/** The published example's button: a fixed package, two units. */
const FIXED = '[data-next-action="accept-upsell"][data-next-package-id="2"]';
/** Reads whichever card the visitor picked in the `offer` selector. */
const FROM_SELECTOR =
  '[data-next-action="accept-upsell"][data-next-selector-id="offer"]';
/** Neither a package nor a selector — nothing it could submit. */
const NOTHING_TO_ACCEPT =
  '[data-next-action="accept-upsell"]:not([data-next-package-id]):not([data-next-selector-id])';
/** Forwards to the next page in the funnel once accepted. */
const WITH_NEXT_URL = '[data-next-action="accept-upsell"][data-next-url]';

/** One `POST .../upsells/` body, as the button sent it. */
interface UpsellPost {
  lines?: Array<{ package_id: number; quantity: number }>;
  currency?: string;
}

/** The `upsell:accepted` payload, as far as these tests read it. */
interface AcceptedEvent {
  packageId: number;
  quantity: number;
  orderId: string;
  value: number;
  discount: number;
}

/**
 * Stub `POST /api/v1/orders/{ref}/upsells/` with the order that already carries
 * the added line, and record every request body so a test can assert what the
 * button actually sent.
 *
 * Registered after `stubOrder`, whose pattern also matches this URL — Playwright
 * checks route handlers in reverse registration order, so the later, narrower one
 * wins.
 */
async function stubAcceptUpsell(page: Page): Promise<UpsellPost[]> {
  const posts: UpsellPost[] = [];
  await page.route('**/api/v1/orders/*/upsells/**', route => {
    posts.push(route.request().postDataJSON() as UpsellPost);
    return route.fulfill({ json: TEST_ORDER_WITH_UPSELL });
  });
  return posts;
}

/** Resolves once the order is in the store — the buttons are inert before that. */
async function waitForOrder(page: Page): Promise<void> {
  await expect(page.locator('[data-next-display="order.number"]')).toHaveText(
    'E2E-1001'
  );
}

let posts: UpsellPost[];

test.beforeEach(async ({ page }) => {
  await stubCampaign(page, RICH_CAMPAIGN);
  await stubCart(page);
  await stubOrder(page);
  posts = await stubAcceptUpsell(page);
});

test('enables the accept button once the paid order is loaded', async ({
  page,
}) => {
  await bootSdk(page, FIXTURE);
  await waitForOrder(page);

  await expect(page.locator(FIXED)).toBeEnabled();
  await expect(page.locator(FIXED)).not.toHaveClass(/next-disabled/);

  // A button with no package and no selector has nothing it could submit.
  await expect(page.locator(NOTHING_TO_ACCEPT)).toBeDisabled();
  await expect(page.locator(NOTHING_TO_ACCEPT)).toHaveClass(/next-disabled/);
});

test('accepting adds the package to the order and emits upsell:accepted', async ({
  page,
}) => {
  await bootSdk(page, FIXTURE);
  await waitForOrder(page);

  const accepted = await captureEvents(page, 'upsell:accepted');
  await page.click(FIXED);

  await expect.poll(() => accepted.count()).toBeGreaterThan(0);

  // data-next-quantity="2" reaches the API as the line quantity.
  expect(posts).toHaveLength(1);
  expect(posts[0]?.lines).toEqual([{ package_id: 2, quantity: 2 }]);
  expect(posts[0]?.currency).toBe('USD');

  const payload = (await accepted.at(0)) as AcceptedEvent;
  expect(payload.packageId).toBe(2);
  expect(payload.quantity).toBe(2);
  expect(payload.orderId).toBe('test-order-ref');
  // Revenue and discount come from the new is_upsell line, not from the offer.
  expect(payload.value).toBe(49.98);
  expect(payload.discount).toBeCloseTo(10, 2);
});

test('a second accept of the same package asks before adding it twice', async ({
  page,
}) => {
  await bootSdk(page, FIXTURE);
  await waitForOrder(page);

  await page.click(FIXED);
  await expect.poll(() => posts.length).toBe(1);

  // The confirmation's labels do not map to the button actions you would guess:
  // "Skip to Next" is the decline, and it must not add a second copy.
  await page.click(FIXED);
  await expect(page.locator('.next-modal')).toBeVisible();
  await expect(page.locator('.next-modal')).toContainText('Already Added!');
  await page.click('.next-modal-confirm');
  expect(posts).toHaveLength(1);

  // "Yes, Add Again" does add it a second time — the order then holds two copies.
  await page.click(FIXED);
  await page.click('.next-modal-cancel');
  await expect.poll(() => posts.length).toBe(2);
});

test('a selector-driven button accepts whichever card the visitor picked', async ({
  page,
}) => {
  await bootSdk(page, FIXTURE);
  await waitForOrder(page);

  await page.click('[data-next-selector-card][data-next-package-id="5"]');

  await expect(page.locator(FROM_SELECTOR)).toBeEnabled();
  await page.click(FROM_SELECTOR);

  await expect.poll(() => posts.length).toBe(1);
  // The card's package, not the button's — the button declares none.
  expect(posts[0]?.lines).toEqual([{ package_id: 5, quantity: 1 }]);
});

test('data-next-url forwards the visitor, keeping the order reference', async ({
  page,
}) => {
  await bootSdk(page, FIXTURE);
  await waitForOrder(page);

  await page.click(WITH_NEXT_URL);

  await page.waitForURL(
    /\/e2e\/fixtures\/order-display\.html\?.*ref_id=test-order-ref/
  );
  expect(posts).toHaveLength(1);
  expect(posts[0]?.lines).toEqual([{ package_id: 1, quantity: 1 }]);
});
