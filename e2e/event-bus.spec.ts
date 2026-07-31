import { test, expect } from '@playwright/test';
import { MINIMAL_CAMPAIGN } from './fixtures/campaign';
import { stubCampaign, stubCart, bootSdk } from './fixtures/routes';

/**
 * EventBus round-trips: a subscriber added via the `window.next` facade `on(...)`
 * receives an event triggered by another enhancer; a manual emit delivers a
 * custom payload; and `off(...)` stops delivery.
 *
 * FINDING: the `window.next` facade exposes `on`/`off` but NO public `emit`.
 * The emit side of these tests therefore uses the exported `EventBus` singleton
 * (the same instance NextCommerce.on/off delegate to).
 */

const FIXTURE = '/e2e/fixtures/event-bus.html';

test.beforeEach(async ({ page }) => {
  await stubCampaign(page, MINIMAL_CAMPAIGN);
  await stubCart(page);
});

test('cross-enhancer: on() receives an event fired by the add-to-cart enhancer', async ({
  page,
}) => {
  await bootSdk(page, FIXTURE);

  const gotEvent = page.evaluate(
    () =>
      new Promise<any>(resolve => {
        (window as any).next.on('cart:item-added', (d: any) => resolve(d));
      })
  );

  await page.click('[data-next-action="add-to-cart"]');

  const payload = await gotEvent;
  expect(payload.packageId).toBe(1);
});

test('emit() delivers a payload to on() subscribers', async ({ page }) => {
  await bootSdk(page, FIXTURE);

  const received = await page.evaluate(async () => {
    const { EventBus }: any = await import('/src/index.ts');
    const sdk = (window as any).next;
    return await new Promise<any>(resolve => {
      sdk.on('cart:package-swapped', (d: any) => resolve(d));
      EventBus.getInstance().emit('cart:package-swapped', {
        previousPackageId: 1,
        newPackageId: 2,
        priceDifference: 5,
      });
    });
  });

  expect(received).toMatchObject({ previousPackageId: 1, newPackageId: 2 });
});

test('off() unsubscribes a handler', async ({ page }) => {
  await bootSdk(page, FIXTURE);

  const callCount = await page.evaluate(async () => {
    const { EventBus }: any = await import('/src/index.ts');
    const bus = EventBus.getInstance();
    const sdk = (window as any).next;
    let count = 0;
    const handler = () => {
      count++;
    };
    sdk.on('cart:item-added', handler);
    bus.emit('cart:item-added', { packageId: 1, quantity: 1 });
    sdk.off('cart:item-added', handler);
    bus.emit('cart:item-added', { packageId: 1, quantity: 1 });
    return count;
  });

  // Fired once before off(), not after.
  expect(callCount).toBe(1);
});
