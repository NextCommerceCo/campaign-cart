import { test, expect } from '@playwright/test';
import { MINIMAL_CAMPAIGN } from './fixtures/campaign';
import { stubCampaign, stubCart, bootSdk, captureEvents } from './fixtures/routes';

/**
 * E2E for the ScrollHintEnhancer (ui/), activated by
 * `data-next-component="scroll-hint"`.
 *
 * FINDING: the guide/task described the hint as active "when not scrolled to
 * bottom". The source (scroll-hint.enhancer.ts:143-151) actually toggles the
 * active state on being at the TOP: the hint is active + aria-hidden="false"
 * while `scrollTop <= threshold` (and content overflows), and is removed +
 * aria-hidden="true" once the user scrolls away from the top. These tests
 * assert that verified behavior.
 */

const FIXTURE = '/e2e/fixtures/scroll-hint.html';

test.beforeEach(async ({ page }) => {
  await stubCampaign(page, MINIMAL_CAMPAIGN);
  await stubCart(page);
});

test('is active at the top when content overflows and emits scroll-hint:updated', async ({
  page,
}) => {
  await bootSdk(page, FIXTURE);

  const host = page.locator('[data-next-component="scroll-hint"]');

  // Initial check runs on init: overflowing + at top → active.
  await expect(host).toHaveClass(/cart-items__scroll-hint--active/);
  await expect(host).toHaveAttribute('aria-hidden', 'false');

  // The init emit fired before window.next existed; capture then re-emit by
  // firing a scroll event while still at the top (scrollTop 0).
  const updated = await captureEvents(page, 'scroll-hint:updated');
  await page.locator('#list').evaluate(el => el.dispatchEvent(new Event('scroll')));

  await expect.poll(async () => (await updated.all()).length).toBeGreaterThan(0);
  const payload = await updated.at(0);
  expect(payload.isVisible).toBe(true);
  expect(payload.scrollHeight).toBeGreaterThan(payload.clientHeight);
  expect(payload).toHaveProperty('scrollTop');
});

test('deactivates once scrolled away from the top', async ({ page }) => {
  await bootSdk(page, FIXTURE);

  const host = page.locator('[data-next-component="scroll-hint"]');
  await expect(host).toHaveClass(/cart-items__scroll-hint--active/);

  // Scroll the inner list down past the threshold.
  await page.locator('#list').evaluate(el => {
    el.scrollTop = el.scrollHeight;
    el.dispatchEvent(new Event('scroll'));
  });

  await expect(host).not.toHaveClass(/cart-items__scroll-hint--active/);
  await expect(host).toHaveAttribute('aria-hidden', 'true');
});
