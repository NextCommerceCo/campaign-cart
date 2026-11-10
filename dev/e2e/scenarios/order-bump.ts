import type { Scenario } from '../harness';

/** An order bump flagged `is_upsell` is part of the purchase; an upsell accepted afterwards is its own event (#141). */
export const scenario: Scenario = async (t) => {
  await t.open('/olympus/checkout/');
  await t.fillCheckout();
  await t.page.click('[data-next-toggle-card][data-next-package-id="7"]');
  await t.page.waitForSelector('[data-next-toggle-card][data-next-package-id="7"].next-in-cart');
  await t.pay();
  await t.arrive(/upsell-bundle-stepper\/\?ref_id=DEV/);
  const bump = t.orderBody()?.lines.find((line: { package_id: number }) => line.package_id === 7);
  t.check(bump?.is_upsell === true, 'the order is sent with the bump flagged is_upsell', t.orderBody()?.lines);

  const purchase = await t.event('dl_purchase');
  const items = purchase?.ecommerce?.items ?? [];
  t.check(
    items.some((item: { item_name: string }) => /Warranty/.test(item.item_name)),
    '#141 the bump is an item of dl_purchase',
    items.map((item: { item_name: string }) => item.item_name),
  );
  t.check(
    purchase?.ecommerce?.value === 63.99,
    '#141 dl_purchase value counts the bump: 49.00 + 14.99',
    purchase?.ecommerce?.value,
  );
  await t.page.waitForTimeout(1500);
  const early = (await t.events()).filter((e) => e.event === 'dl_upsell_purchase');
  t.check(early.length === 0, '#141 no dl_upsell_purchase for the bump', early.length);

  await t.page.click('[data-next-upsell-action="add"]', { force: true });
  await t.arrive(/tier-pills\/\?ref_id=DEV/);
  const upsell = await t.event('dl_upsell_purchase');
  const names = (upsell?.ecommerce?.items ?? []).map((item: { item_name: string }) => item.item_name);
  t.check(
    names.length === 1 && /Case/.test(names[0]),
    '#141 the upsell accepted afterwards pushes dl_upsell_purchase with its own line only',
    names,
  );
  const all = (await t.events()).filter((e) => e.event === 'dl_upsell_purchase');
  t.check(all.length === 1, '#141 one dl_upsell_purchase in the whole visit', all.length);
};
