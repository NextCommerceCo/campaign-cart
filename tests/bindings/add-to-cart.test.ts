import { afterEach, describe, expect, it, vi } from 'vitest';
import { startAnalytics } from '../../src/analytics';
import { heldApi } from '../fixtures/api';
import { flush } from '../fixtures/engine';
import { mount } from '../fixtures/pages';

const win = window as unknown as { dataLayer?: Array<{ event?: string }> };
const BUY = `<a id="buy" href="#" data-next-action="add-to-cart" data-next-package-id="1" data-next-quantity="2" data-next-url="/checkout"></a>`;
const prices = (api: ReturnType<typeof heldApi>) => api.calls.filter((c) => c.body?.lines && c.body.vouchers);

afterEach(() => {
  document.body.innerHTML = '';
  delete win.dataLayer;
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('add to cart', () => {
  it('adds and goes to the next page with attribution params', async () => {
    const { engine, navigate, $ } = await mount(BUY, { params: { utm_source: 'fb', debugger: 'true' } });
    $('#buy').click();
    expect(engine.cart.lines()).toEqual([{ package_id: 1, quantity: 2 }]);
    await flush();
    expect(navigate).toHaveBeenCalledWith(`${location.origin}/checkout?utm_source=fb`);
    $('#buy').click();
    expect(engine.cart.lines()).toEqual([{ package_id: 1, quantity: 2 }]);
  });

  describe('before it leaves the page', () => {
    const page = async (html = BUY) => {
      const api = heldApi();
      return { ...(await mount(html, { fetch: api.fetch })), api };
    };

    it('prices the add before the click, so the click sends dl_add_to_cart and then goes', async () => {
      const { api, engine, navigate, $ } = await page();
      startAnalytics(engine, { apiKey: 'pk_test', version: 'test', nextCampaign: false });
      expect(prices(api).map((c) => c.body.lines)).toEqual([[{ package_id: 1, quantity: 2 }]]);
      const sent: string[][] = [];
      navigate.mockImplementation(() => sent.push(win.dataLayer!.flatMap((e) => e.event ?? [])));
      $('#buy').click();
      await flush();
      expect(prices(api)).toHaveLength(1);
      expect(navigate).toHaveBeenCalledOnce();
      expect(sent[0]).toContain('dl_add_to_cart');
    });

    it('waits for a price that is still on its way', async () => {
      const { api, navigate, $ } = await page(
        BUY.replace('data-next-url', 'data-next-clear-cart="true" data-next-url'),
      );
      api.hold();
      $('#buy').setAttribute('data-next-quantity', '3');
      $('#buy').click();
      await flush();
      expect(navigate).not.toHaveBeenCalled();
      api.release();
      await flush();
      expect(navigate).toHaveBeenCalledOnce();
    });

    it('goes without the price when pricing fails, and after 3 s when it does not answer', async () => {
      const api = heldApi();
      let answer: (r: Response) => void = () => {};
      let fail = false;
      const fetch = ((input, init) =>
        fail ? new Promise<Response>((r) => (answer = r)) : api.fetch(input, init)) as typeof api.fetch;
      const failing = await mount(BUY, { fetch });
      fail = true;
      failing.$('#buy').setAttribute('data-next-quantity', '5');
      failing.$('#buy').click();
      await flush();
      expect(failing.navigate).not.toHaveBeenCalled();
      answer(new Response('{}', { status: 500 }));
      await flush();
      expect(failing.navigate).toHaveBeenCalledOnce();

      const silent = await page();
      silent.api.hold();
      silent.$('#buy').setAttribute('data-next-quantity', '4');
      vi.useFakeTimers();
      silent.$('#buy').click();
      await vi.advanceTimersByTimeAsync(2999);
      expect(silent.navigate).not.toHaveBeenCalled();
      await vi.advanceTimersByTimeAsync(1);
      expect(silent.navigate).toHaveBeenCalledOnce();
    });
  });
});
