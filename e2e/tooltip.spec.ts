import { test, expect } from '@playwright/test';
import { MINIMAL_CAMPAIGN } from './fixtures/campaign';
import { stubCampaign, stubCart, bootSdk } from './fixtures/routes';

/**
 * E2E for the TooltipEnhancer (ui/), activated by `data-next-tooltip`.
 * A floating `.next-tooltip` is appended to <body> on hover/focus and removed
 * (visibility class + aria-describedby) on leave/blur.
 */

const FIXTURE = '/e2e/fixtures/tooltip.html';

test.beforeEach(async ({ page }) => {
  await stubCampaign(page, MINIMAL_CAMPAIGN);
  await stubCart(page);
});

test('shows a floating tooltip on hover and wires aria-describedby / role', async ({
  page,
}) => {
  await bootSdk(page, FIXTURE);

  const target = page.locator('#target');
  await target.hover();

  const tooltip = page.locator('.next-tooltip');
  await expect(tooltip).toHaveClass(/next-tooltip--visible/);
  await expect(tooltip).toHaveAttribute('role', 'tooltip');
  await expect(tooltip.locator('.next-tooltip__content')).toHaveText(
    'Helpful text'
  );

  // The target points at the tooltip's generated id for screen readers.
  const tooltipId = await tooltip.getAttribute('id');
  expect(tooltipId).toBeTruthy();
  await expect(target).toHaveAttribute('aria-describedby', tooltipId!);
});

test('hides the tooltip and clears aria-describedby on mouse-out', async ({
  page,
}) => {
  await bootSdk(page, FIXTURE);

  const target = page.locator('#target');
  await target.hover();
  await expect(page.locator('.next-tooltip')).toHaveClass(
    /next-tooltip--visible/
  );

  // Move the pointer far away from the target.
  await page.mouse.move(5, 400);

  await expect(page.locator('.next-tooltip--visible')).toHaveCount(0);
  await expect(target).not.toHaveAttribute('aria-describedby', /.+/);
});
