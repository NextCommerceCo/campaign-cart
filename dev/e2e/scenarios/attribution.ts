import type { Scenario } from '../harness';

/** What a visit's params, the page's metadata and the Meta cookie put on the order (#130, #113, #142, #122, #132). */
export const scenario: Scenario = async (t) => {
  await t.open('/olympus/checkout/', { affid: 'A1', utm_source: 'fb', sub1: 'S1' });
  const set = await t.page.evaluate(async () => {
    const next = (window as any).next;
    const result = await next.actions.setMetadata({ quiz_result: 'dry', everflow_transaction_id: 'ev1' });
    const legacy = ['setMetadata', 'addMetadata', 'getMetadata', 'clearMetadata'].map((n) => typeof next[n]);
    return { result, legacy, read: next.getMetadata?.().quiz_result };
  });
  t.check(set.result?.ok === true, '#130 next.actions.setMetadata resolves ok', set.result);
  t.check(
    set.legacy.every((type) => type === 'function'),
    '#130 the four 0.4.x metadata methods exist',
    set.legacy,
  );
  t.check(set.read === 'dry', '#130 next.getMetadata() reads the value back', set.read);
  await t.page.evaluate(() => (document.cookie = '_fbp=fb.1.1700000000000.e2e; path=/'));

  await t.fillCheckout();
  await t.pay();
  await t.arrive(/upsell-bundle-stepper\/\?ref_id=DEV/);
  const order = t.orderBody();
  const { metadata = {}, ...attribution } = order?.attribution ?? {};
  t.check(order?.payment_detail, '#28/#113 an order body was sent');
  t.check(metadata.quiz_result === 'dry', "#130 the order carries the page's metadata", metadata.quiz_result);
  t.check(
    attribution.everflow_transaction_id === 'ev1',
    "#130 everflow_transaction_id is the order's Everflow id",
    attribution.everflow_transaction_id,
  );
  t.check(attribution.affiliate === 'A1', 'attribution keeps the affiliate', attribution.affiliate);
  t.check(
    /affid=A1/.test(order?.success_url) && /utm_source=fb/.test(order?.success_url),
    '#113 success_url carries the visit params',
    order?.success_url,
  );
  const longest = Math.max(0, ...Object.values(metadata).map((value) => [...String(value)].length));
  t.check(longest <= 2000, '#142 no metadata value is longer than 2000', longest);
  t.check(
    metadata.fb_fbp === 'fb.1.1700000000000.e2e',
    '#132 a _fbp cookie set after the SDK booted is in the order',
    metadata.fb_fbp,
  );
  t.check(/affid=A1/.test(t.page.url()), 'the upsell page URL keeps affid', t.page.url());

  const landing = `${t.origin}/olympus/landing/?affid=R9&utm_source=ref&other=x`;
  await t.open('/olympus/checkout/', {}, { tab: true, referer: landing });
  const adopted = await t.page.evaluate(() => (window as any).next.context().attribution);
  t.check(
    adopted?.affiliate === 'R9' && adopted?.utm_source === 'ref',
    '#122 attribution adopted from a same-site referrer',
    adopted,
  );

  await t.open('/olympus/checkout/', {}, { tab: true, referer: 'https://other.example/?affid=EVIL' });
  const none = await t.page.evaluate(() => (window as any).next.context().attribution);
  t.check(none?.affiliate === undefined, '#122 nothing adopted from another site', none);
};
