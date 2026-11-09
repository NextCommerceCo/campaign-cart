import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { bindAll } from '../../src/bindings';
import * as translator from '../../src/compat/legacy';
import { legacyEvents } from '../../src/compat/legacy/registry';
import { bindOrder } from '../../src/order';
import { fakeApi, json } from '../fixtures/api';
import { flush, makeEngine } from '../fixtures/engine';
import { FakeObserver, visible } from '../bindings/observer';

function heard(source: { on(name: string, fn: (data: unknown) => void): unknown }, name: string) {
  const payloads: unknown[] = [];
  source.on(name, (data) => payloads.push(data));
  return payloads;
}

async function upsellPage(api = fakeApi()) {
  history.replaceState(null, '', '/upsell/?ref_id=R1');
  document.body.innerHTML = `<div id="offer" data-next-upsell data-next-package-id="3"><button data-next-upsell-action="add">Add</button></div>`;
  const { engine } = makeEngine({ fetch: api.fetch, params: { ref_id: 'R1' }, session: sessionStorage });
  await engine.start();
  const legacy = legacyEvents(engine, () => translator);
  const viewed = heard(legacy, 'upsell:viewed');
  const error = heard(legacy, 'upsell:error');
  const failed = heard(legacy, 'action:failed');
  const events: string[] = [];
  engine.on('*', (e) => void events.push(e.name));
  bindAll(document, engine, () => {});
  await bindOrder(engine, vi.fn());
  await flush();
  return { viewed, error, failed, events, offer: document.getElementById('offer')! };
}

beforeEach(() => {
  sessionStorage.clear();
  FakeObserver.all = [];
  vi.stubGlobal('IntersectionObserver', FakeObserver);
});

afterEach(() => {
  vi.unstubAllGlobals();
  document.body.innerHTML = '';
});

describe('0.4.x upsell events', () => {
  it('sends upsell:viewed when the offer is shown, before it is on screen, as 0.4.43', async () => {
    const { viewed, events, offer } = await upsellPage();
    expect(viewed).toEqual([{ pagePath: '/upsell/', orderId: 'R1' }]);
    expect(events).not.toContain('upsell.viewed');
    visible(offer, 1);
    expect(events).toContain('upsell.viewed');
    expect(viewed).toHaveLength(1);
  });

  it('sends upsell:initialized with the picked package of an offer whose selector has no id', async () => {
    history.replaceState(null, '', '/upsell/?ref_id=R1');
    document.body.innerHTML = `<div id="offer" data-next-upsell>
      <div data-next-bundle-selector>
        <div data-next-bundle-card data-next-bundle-id="a" data-next-bundle-items='[{"packageId":2,"quantity":1}]'></div>
      </div>
      <button data-next-upsell-action="add">Add</button></div>`;
    const { engine } = makeEngine({ params: { ref_id: 'R1' }, session: sessionStorage });
    await engine.start();
    const initialized = heard(
      legacyEvents(engine, () => translator),
      'upsell:initialized',
    );
    bindAll(document, engine, () => {});
    await bindOrder(engine, vi.fn());
    await flush();
    expect(initialized).toEqual([{ packageId: 2, element: document.getElementById('offer') }]);
  });

  it('sends upsell:error and action:failed for a declined upsell, as 0.4.43', async () => {
    const declined = json({ payment_response_code: '05', payment_details: 'Your card was declined.' }, 400);
    const { error, failed, events } = await upsellPage(fakeApi({ upsell: () => declined }));
    document.querySelector<HTMLElement>('#offer button')!.click();
    await vi.waitFor(() => expect(error).toHaveLength(1));
    expect(error).toEqual([{ packageId: 3, error: 'Your card was declined.' }]);
    expect(failed).toEqual([{ action: 'AcceptUpsellEnhancer', error: expect.any(Error) }]);
    expect(events).toContain('payment.failed');
    expect(events).not.toContain('upsell.failed');
    expect(events).not.toContain('sdk.error');
  });
});
