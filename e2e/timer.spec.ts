import { test, expect } from '@playwright/test';
import { stubAll, bootSdk, captureEvents } from './fixtures/routes';

/**
 * E2E for the timer enhancer (`data-next-timer`).
 *
 * A 2-second countdown writes remaining time into its `[data-next-timer-display]`
 * child, then on expiry hides itself, reveals the matching
 * `[data-next-timer-expired]` element, and emits `timer:expired`.
 *
 * The timer persists its start time in `localStorage` under `next-timer-e2e`;
 * we clear localStorage before every navigation so each run starts fresh.
 */

const FIXTURE = '/e2e/fixtures/timer.html';

test.beforeEach(async ({ page }) => {
  await stubAll(page);
  // Clear the persisted start time before any page script runs.
  await page.addInitScript(() => localStorage.clear());
});

test('counts down, then expires and swaps to the expired message', async ({
  page,
}) => {
  await bootSdk(page, FIXTURE);

  const expired = await captureEvents(page, 'timer:expired');

  const display = page.locator('#timer [data-next-timer-display]');
  // 2s duration, mm:ss format => starts at 00:02.
  await expect(display).toHaveText('00:02');

  // Timer fires timer:expired with its persistenceId when it reaches zero.
  await expect
    .poll(() => expired.count(), { timeout: 6000 })
    .toBeGreaterThan(0);
  expect((await expired.at(0)).persistenceId).toBe('e2e');

  // On expiry the timer hides and the expired element is revealed.
  await expect(page.locator('#timer')).toHaveCSS('display', 'none');
  await expect(page.locator('#expired')).not.toHaveCSS('display', 'none');
});
