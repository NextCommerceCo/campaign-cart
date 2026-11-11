import type { Run, Scenario } from '../harness';

const META = { analytics: { providers: { facebook: { enabled: true, settings: { pixelId: 'e2e' } } } } };

const sent = async (t: Run, name: string) =>
  (await t.fbq()).filter(({ args }) => args[0] === 'track' && args[1] === name).map(({ args }) => args);

async function add(t: Run, button: string, adds: number) {
  await t.page.click(button);
  for (const until = Date.now() + 8000; Date.now() < until; await t.page.waitForTimeout(100)) {
    if ((await t.tracking()).filter((e) => e.event_type === 'product_added_to_cart').length >= adds) break;
  }
  await t.page.waitForTimeout(300);
}

/** What the Meta destination sends to the page's `fbq` (#139, #126). */
export const scenario: Scenario = async (t) => {
  await t.pixel();
  await t.config(META);
  await t.open('/e2e/shop/');
  await add(t, '#add-1', 1);
  const first = await sent(t, 'AddToCart');
  t.check(
    first.length === 1 && first[0]![2].content_ids.join() === '1' && first[0]![2].value === 49,
    '#126 the first add of the tab sends AddToCart',
    first,
  );
  t.check((await sent(t, 'PageView')).length === 1, '#139 one PageView for the page load', await sent(t, 'PageView'));

  await add(t, '#add-3', 2);
  await t.page.reload();
  await t.ready();
  await add(t, '#add-3', 3);
  const adds = (await t.tracking()).filter((e) => e.event_type === 'product_added_to_cart').length;
  t.check(adds === 3, 'three adds were tracked', adds);
  t.check(
    (await sent(t, 'AddToCart')).length === 1,
    '#126 the later adds send no AddToCart',
    await sent(t, 'AddToCart'),
  );
  const views = await sent(t, 'PageView');
  t.check(
    views.length === 2 && views[0]![3].eventID !== views[1]![3].eventID,
    '#139 the second page load sends one more PageView, with its own eventID',
    views,
  );
};
