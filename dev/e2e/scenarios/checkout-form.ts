import type { Scenario } from '../harness';

/** What the checkout form is filled with before the shopper types (#60). */
export const scenario: Scenario = async (t) => {
  await t.open('/olympus/checkout/');
  const months = await t.page.evaluate(() =>
    [...document.querySelector<HTMLSelectElement>('[data-next-checkout-field="exp-month"]')!.options].map(
      (option) => option.text,
    ),
  );
  t.check(
    months.some((month) => /January/.test(month)),
    '#60 expiry months are filled',
    months.slice(0, 3),
  );
};
