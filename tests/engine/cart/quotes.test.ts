import { describe, expect, it } from 'vitest';
import { fakeApi } from '../../fixtures/api';
import { flush, makeEngine } from '../../fixtures/engine';

const calculations = (api: ReturnType<typeof fakeApi>) => api.calls.filter((c) => c.url.includes('/carts/calculate'));
const BODY = { lines: [{ package_id: 1, quantity: 1 }], vouchers: ['SAVE10', 'BUNDLE'], currency: 'USD' };

describe('quotes', () => {
  it('prices a toggle once per cart it sits beside, so a cart that comes back reuses its price', async () => {
    const api = fakeApi();
    const { engine } = makeEngine({ fetch: api.fetch });
    await engine.start();
    const toggle = () => calculations(api).filter((c) => c.body.lines.some((l: any) => l.package_id === 9)).length;
    for (const quantity of [1, 2, 1, 2]) {
      await engine.cart.setQuantity(1, quantity);
      engine.toggles.price(9, 1);
      await flush();
    }
    expect(toggle()).toBe(2);
    expect(engine.getState().toggles[9]?.line).toMatchObject({ package_id: 9, quantity: 1 });
  });

  it('sends one request for the same payload, whoever asks and in whatever voucher order', async () => {
    const api = fakeApi({ delays: [20] });
    const { engine } = makeEngine({ fetch: api.fetch });
    await engine.start();
    const leaving = new AbortController();
    const first = engine.cart.quotes.calculate(BODY, { signal: leaving.signal });
    const second = engine.cart.quotes.calculate({ ...BODY, vouchers: ['BUNDLE', 'SAVE10'] });
    leaving.abort();
    await expect(first).rejects.toThrow();
    await expect(second).resolves.toMatchObject({ total: '39.00' });
    await engine.cart.quotes.calculate(BODY);
    expect(calculations(api)).toHaveLength(1);
  });

  it('cancels a request once everyone waiting on it leaves, and asks again next time', async () => {
    const api = fakeApi({ delays: [20] });
    const { engine } = makeEngine({ fetch: api.fetch });
    await engine.start();
    const leaving = new AbortController();
    const first = engine.cart.quotes.calculate(BODY, { signal: leaving.signal });
    leaving.abort();
    await expect(first).rejects.toThrow();
    await expect(engine.cart.quotes.calculate(BODY)).resolves.toMatchObject({ total: '39.00' });
    expect(calculations(api)).toHaveLength(2);
  });
});
