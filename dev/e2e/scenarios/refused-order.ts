import type { Run, Scenario } from '../harness';

const SAID = 'Don’t have enough stock for Olympus x1.';

const shown = (t: Run, box: string) =>
  t.page.evaluate((name) => {
    const el = document.querySelector<HTMLElement>(`[data-next-component="${name}-error"]`);
    const text = document.querySelector(`[data-next-component="${name}-error-text"]`)?.textContent?.trim();
    return el && getComputedStyle(el).display !== 'none' ? text : undefined;
  }, box);

const told = (t: Run) =>
  t.page.evaluate(
    () =>
      new Promise<{ error: { code: string; message: string }; logged: string[] }>((done) =>
        (window as any).next.on('checkout.failed', ({ error }: any) =>
          done({ error, logged: (window as any).next.log.entries().map((entry: any) => entry.message) }),
        ),
      ),
  );

/** An order the API refuses by field: what the shopper reads, and what the log and `checkout.failed` keep (#28). */
export const scenario: Scenario = async (t) => {
  await t.api('/api/v1/orders/', 400, { lines: [SAID] });
  t.expect(/status of 400/);
  await t.open('/olympus/checkout/');
  await t.fillCheckout();
  await t.pay();
  await t.page.waitForSelector('[data-next-component="credit-error"]', { state: 'visible' });
  const card = await shown(t, 'credit');
  t.check(
    /item in your order/i.test(card ?? ''),
    "#28 the form's error box says which part of the order was refused",
    card,
  );
  const { error, logged } = await told(t);
  t.check(error.message.includes(SAID), "#28 checkout.failed carries the API's text", error);
  const entry = logged.find((message) => message.includes(SAID));
  t.check(entry, "#28 next.log.entries() keeps the API's text", entry);

  await t.page.click('[data-next-express-checkout="paypal"]');
  await t.page.waitForSelector('[data-next-component="express-error"]', { state: 'visible' });
  const sent = t.orderBody()?.payment_detail?.payment_method;
  const express = await shown(t, 'express');
  t.check(sent === 'paypal', 'the express PayPal button sends its own order', sent);
  t.check(/item in your order/i.test(express ?? ''), '#28 the express error box says the same', express);
  t.check((await shown(t, 'credit')) === undefined, '#28 only the express error box is shown then');
};
