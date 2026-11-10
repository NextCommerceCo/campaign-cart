import type { Json, Scenario } from '../harness';

const names = (events: Json[]) => events.map((e) => e.event as string);

/** The `dl_*` pushes of a checkout: shipping info once an address is in, the customer on the purchase (#140, #134). */
export const scenario: Scenario = async (t) => {
  await t.open('/olympus/checkout/');
  const begin = await t.event('dl_begin_checkout');
  await t.page.waitForTimeout(1500);
  const before = names(await t.events());
  t.check(!before.includes('dl_add_shipping_info'), '#140 no dl_add_shipping_info before an address', before);

  await t.fillCheckout();
  await t.event('dl_add_shipping_info');
  const after = names(await t.events());
  t.check(
    after.filter((name) => name === 'dl_add_shipping_info').length === 1 &&
      after.indexOf('dl_begin_checkout') < after.indexOf('dl_add_shipping_info'),
    '#140 one dl_add_shipping_info, after dl_begin_checkout',
    after,
  );
  t.check(
    Object.keys(begin?.user_properties ?? {}).join() === 'visitor_type',
    '#134 dl_begin_checkout carries visitor_type only',
    begin?.user_properties,
  );

  await t.pay();
  await t.arrive(/upsell-bundle-stepper\/\?ref_id=DEV/);
  const purchase = await t.event('dl_purchase');
  t.check(purchase, '#134 dl_purchase was pushed (on the checkout or the next page)');
  t.check(
    purchase?.user_properties?.customer_email === 'e2e@example.com',
    '#134 dl_purchase carries the customer',
    purchase?.user_properties,
  );
};
