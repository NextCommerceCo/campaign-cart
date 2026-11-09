import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { bindAll } from '../../src/bindings';
import * as translator from '../../src/compat/legacy';
import { legacyEvents } from '../../src/compat/legacy/registry';
import { bindOrder } from '../../src/order';
import { fakeApi, json } from '../fixtures/api';
import { ORDER, withUpsell } from '../fixtures/order';
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

async function offerPage(html: string, api = fakeApi()) {
  history.replaceState(null, '', '/upsell/?ref_id=R1');
  document.head.innerHTML = '<meta name="next-upsell-accept-url" content="/thanks/">';
  document.body.innerHTML = html;
  const next = {} as Record<string, any>;
  vi.stubGlobal('next', next);
  const { engine } = makeEngine({ fetch: api.fetch, params: { ref_id: 'R1' }, session: sessionStorage });
  await engine.start();
  bindAll(document, engine, () => {});
  const navigate = vi.fn();
  await bindOrder(engine, navigate);
  await flush();
  const posted = () => api.calls.filter((c) => c.url.includes('/upsells/')).map((c) => c.body.lines);
  return { next, navigate, posted, offer: document.querySelector<HTMLElement>('[data-next-upsell]')! };
}

const TOGGLES = [1, 2, 3].map((n) => `<div data-next-upsell-quantity-toggle="${n}">${n}</div>`).join('');

describe('0.4.x data-next-upsell-quantity-toggle', () => {
  it('adds the quantity the shopper toggled and marks that toggle selected', async () => {
    const { posted, offer } = await offerPage(
      `<div data-next-upsell="offer" data-next-package-id="3">${TOGGLES}<a data-next-upsell-action="add" href="#">Add</a></div>`,
    );
    const toggles = [...offer.querySelectorAll<HTMLElement>('[data-next-upsell-quantity-toggle]')];
    expect(toggles.map((t) => t.classList.contains('next-selected'))).toEqual([true, false, false]);
    toggles[2]!.click();
    expect(toggles.map((t) => t.classList.contains('next-selected'))).toEqual([false, false, true]);
    offer.querySelector<HTMLElement>('[data-next-upsell-action]')!.click();
    await vi.waitFor(() => expect(posted()).toEqual([[{ package_id: 3, quantity: 3 }]]));
  });
});

describe('0.4.x upsell methods on window.next', () => {
  const MV = `<div data-next-upsell="offer">${TOGGLES}<a data-next-upsell-action="add" href="#">Add</a></div>`;

  it('adds the items a script passes to next.addUpsell, and lists them as completed', async () => {
    const api = fakeApi({ upsell: (_, body) => json(withUpsell(ORDER, 99, 2, { package: body.lines[0].package_id })) });
    const { next, posted } = await offerPage(MV, api);
    expect(next.canAddUpsells()).toBe(true);
    expect(next.isUpsellAlreadyAdded(2)).toBe(false);
    const result = await next.addUpsell({ items: [{ packageId: 2, quantity: 2 }] });
    expect(posted()).toEqual([[{ package_id: 2, quantity: 2 }]]);
    expect(result).toMatchObject({ addedLines: [{ id: 99 }], totalValue: 20 });
    expect(next.getCompletedUpsells()).toEqual(['2']);
    expect(next.isUpsellAlreadyAdded(2)).toBe(true);
  });

  it('throws from next.addUpsell without a package, as 0.4.x did', async () => {
    const { next } = await offerPage(MV);
    await expect(next.addUpsell({})).rejects.toThrow('Either packageId or items array must be provided');
  });

  it('finds variant values and the package of a variant pick', async () => {
    const { next } = await offerPage(MV);
    expect(next.getAvailableVariantAttributes(400, 'color')).toEqual(['Black', 'White']);
    expect(next.getPackageByVariantSelection(400, { color: 'White' })?.ref_id).toBe(2);
    expect(next.getPackageByVariantSelection(400, { color: 'Red' })).toBeNull();
  });

  it('keeps the shopper on the page when the offer button has nothing to add', async () => {
    const { navigate, offer, posted } = await offerPage(MV);
    vi.useFakeTimers({ toFake: ['setTimeout'] });
    try {
      offer.querySelector<HTMLElement>('[data-next-upsell-action]')!.click();
      await vi.advanceTimersByTimeAsync(2000);
      expect(navigate).not.toHaveBeenCalled();
      expect(posted()).toEqual([]);
    } finally {
      vi.useRealTimers();
    }
  });
});
