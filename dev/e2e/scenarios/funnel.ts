import type { Scenario } from '../harness';

/** A card order, three upsell pages and the receipt. */
export const scenario: Scenario = async (t) => {
  await t.open('/olympus/checkout/');
  await t.fillCheckout();
  const address = await t.page.evaluate(
    (names) =>
      names.map((n) => (document.querySelector(`[data-next-checkout-field="${n}"]`) as HTMLInputElement).value),
    ['address1', 'city', 'postal'],
  );
  t.check(address.join('|') === '1 Main St|Austin|73301', 'address autocomplete fills the address', address);
  const floated = await t.page.evaluate(
    () =>
      document.querySelector('[data-next-checkout-field="email"]')?.closest('.form-group')?.querySelector('label')
        ?.className,
  );
  t.check(floated?.includes('has-value'), 'the email label floats once filled');
  await t.pay();
  await t.arrive(/upsell-bundle-stepper\/\?ref_id=DEV/);
  t.check(true, 'checkout places a card order and opens the first upsell with ref_id');

  const offer = await t.page.getAttribute('[data-next-upsell]', 'class');
  t.check(offer?.includes('next-available'), 'the offer is available');
  await t.page.click('[data-next-quantity-increase]', { force: true });
  await t.page.waitForFunction(() => document.querySelector('[data-next-quantity-display]')?.textContent === '2');
  await t.page.click('[data-next-upsell-action="add"]', { force: true });
  await t.arrive(/tier-pills\/\?ref_id=DEV/);
  t.check(true, 'the stepped offer is added and the next upsell opens');

  await t.page.click('[data-next-upsell-action="skip"]', { force: true });
  await t.arrive(/tier-cards\/\?ref_id=DEV/);
  t.check(true, 'skipping moves on with ref_id');

  await t.page.click('[data-next-bundle-id="upsell-bundle-3x"]', { force: true });
  await t.page.click('[data-next-upsell-action="add"]', { force: true });
  await t.arrive(/receipt\/\?ref_id=DEV/);
  t.check(true, 'the 3x tier is added and the receipt opens');

  const receipt = await t.page.evaluate(() => ({
    total: document.querySelector('[data-next-display="order.total"]')?.textContent?.trim(),
    name: document.querySelector('[data-next-display="order.customer.name"]')?.textContent?.trim(),
    items: document.querySelector('[data-next-order-items]')?.querySelectorAll('.cart-item__title').length,
  }));
  t.check(receipt.total === '$249.00', 'receipt total is $249.00', receipt.total);
  t.check(receipt.name === 'Jane Doe', 'receipt shows the customer', receipt.name);
  t.check(receipt.items === 3, 'receipt lists the order and both upsells', receipt.items);
  await t.page.waitForFunction(
    () => getComputedStyle(document.querySelector('[data-next-skeleton]')!).opacity === '0',
    null,
    { timeout: 2000 },
  );
  t.check(true, 'the receipt skeleton is lifted');
};
