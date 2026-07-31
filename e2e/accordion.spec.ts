import { test, expect } from '@playwright/test';
import { MINIMAL_CAMPAIGN } from './fixtures/campaign';
import { stubCampaign, stubCart, bootSdk, captureEvents } from './fixtures/routes';

/**
 * E2E for the AccordionEnhancer (ui/), activated by `data-next-accordion`.
 * Asserts the observable contract: ARIA wiring, toggle class, emitted events,
 * and open/close text swap.
 */

const FIXTURE = '/e2e/fixtures/accordion.html';

test.beforeEach(async ({ page }) => {
  await stubCampaign(page, MINIMAL_CAMPAIGN);
  await stubCart(page);
});

test('wires ARIA on the trigger and panel and starts collapsed', async ({
  page,
}) => {
  await bootSdk(page, FIXTURE);

  const trigger = page.locator('[data-next-accordion-trigger="faq1"]');
  const panel = page.locator('[data-next-accordion-panel="faq1"]');
  const container = page.locator('[data-next-accordion="faq1"]');

  await expect(trigger).toHaveAttribute('aria-expanded', 'false');
  await expect(trigger).toHaveAttribute('aria-controls', 'faq1');
  await expect(trigger).toHaveAttribute('tabindex', '0');
  await expect(panel).toHaveAttribute('aria-labelledby', 'faq1');
  await expect(panel).toHaveAttribute('id', 'faq1-content');
  await expect(container).not.toHaveClass(/next-expanded/);
  // Closed default → close-text is shown.
  await expect(page.locator('[data-next-accordion-text="faq1"]')).toHaveText(
    'Show'
  );
});

test('opens on click: emits accordion:toggled + accordion:opened, adds toggle class, swaps text', async ({
  page,
}) => {
  await bootSdk(page, FIXTURE);

  const toggled = await captureEvents(page, 'accordion:toggled');
  const opened = await captureEvents(page, 'accordion:opened');

  const trigger = page.locator('[data-next-accordion-trigger="faq1"]');
  const container = page.locator('[data-next-accordion="faq1"]');

  await trigger.click();

  await expect
    .poll(async () => (await toggled.all()).length)
    .toBeGreaterThan(0);
  expect(await toggled.at(0)).toMatchObject({ id: 'faq1', isOpen: true });
  await expect.poll(async () => (await opened.all()).length).toBeGreaterThan(0);
  expect(await opened.at(0)).toMatchObject({ id: 'faq1' });

  await expect(container).toHaveClass(/next-expanded/);
  await expect(trigger).toHaveAttribute('aria-expanded', 'true');
  await expect(page.locator('[data-next-accordion-text="faq1"]')).toHaveText(
    'Hide'
  );
});

test('closes on a second click: emits accordion:closed and collapses', async ({
  page,
}) => {
  await bootSdk(page, FIXTURE);

  const closed = await captureEvents(page, 'accordion:closed');
  const trigger = page.locator('[data-next-accordion-trigger="faq1"]');
  const container = page.locator('[data-next-accordion="faq1"]');

  await trigger.click(); // open
  await expect(container).toHaveClass(/next-expanded/);

  await trigger.click(); // close

  await expect.poll(async () => (await closed.all()).length).toBeGreaterThan(0);
  expect(await closed.at(0)).toMatchObject({ id: 'faq1' });
  await expect(container).not.toHaveClass(/next-expanded/);
  await expect(trigger).toHaveAttribute('aria-expanded', 'false');
  await expect(page.locator('[data-next-accordion-text="faq1"]')).toHaveText(
    'Show'
  );
});
