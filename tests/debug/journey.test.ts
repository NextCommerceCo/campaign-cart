import { describe, expect, it, vi } from 'vitest';
import { journeyView } from '../../src/debug/journey';
import { createDebug, type PageKind } from '../../src/debug/state';
import { nodes } from '../../src/debug/view';
import { makeEngine } from '../fixtures/engine';
import { MemoryStorage } from '../fixtures/storage';

const visit = (session: Storage, path: string, kind: PageKind) => {
  const { engine } = makeEngine({ session, debug: true });
  const debug = engine.attach((ctx) =>
    createDebug(ctx, {
      at: Date.now(),
      path,
      title: path,
      kind,
      scope: 's1',
      reload: false,
      reset: false,
      lines: engine.cart.lines(),
    }),
  );
  return { engine, debug };
};

async function setup() {
  vi.spyOn(console, 'debug').mockImplementation(() => {});
  const session = new MemoryStorage();
  const landing = visit(session, '/landing/', 'product');
  await landing.engine.start();
  await landing.engine.cart.addItem(1);
  const { engine, debug } = visit(session, '/checkout/', 'checkout');
  await engine.start();
  await engine.cart.settled();
  const root = document.createElement('div');
  const view = journeyView(engine, debug, { render: () => paint() });
  const paint = () => root.replaceChildren(...nodes(view.view()));
  paint();
  const steps = () =>
    [...root.querySelectorAll('.journey > ol > li')].map((s) => [
      s.querySelector('header')!.textContent,
      s.querySelector('button')!.getAttribute('aria-pressed'),
    ]);
  return { engine, root, steps };
}

describe('journey tab', () => {
  it('draws each page of the tab as a step, this page picked', async () => {
    const { root, steps } = await setup();
    expect(steps()).toEqual([
      [expect.stringMatching(/^StartSource\d\d:\d\d:\d\d$/), 'false'],
      [expect.stringMatching(/^Step 1Landing\d\d:\d\d:\d\d · \d+s$/), 'false'],
      [expect.stringMatching(/^Step 2Checkout\d\d:\d\d:\d\d · now$/), 'true'],
    ]);
    const now = root.querySelector('[aria-pressed="true"]')!;
    expect([...now.querySelectorAll('span, small, data')].map((e) => e.textContent)).toEqual([
      '/checkout/Now',
      'Now',
      '/checkout/',
      '$49.00',
      '1 item',
    ]);
    expect(root.querySelector('.jhead > span')!.textContent).toBe('2 pages in this tab');
  });

  it('shows what happened on a picked page, from arriving to leaving', async () => {
    const { root, steps } = await setup();
    root.querySelectorAll<HTMLElement>('.journey button')[1]!.click();
    expect(steps().map(([, pressed]) => pressed)).toEqual(['false', 'true', 'false']);
    const page = root.querySelector('.jpage')!;
    expect([...page.querySelectorAll('.jstats > div')].map((s) => s.textContent)).toEqual([
      'Cart1 item · $49.00',
      'Order—',
      'Analytics0 sent',
      'Problems0',
    ]);
    expect([...page.querySelectorAll('.timeline > li')].map((li) => li.firstChild!.textContent)).toEqual([
      'Arrived from a direct visit',
      'Added Earbuds ×1 ×1',
      'Left for /checkout/',
    ]);
  });

  it('clears the journey down to this page', async () => {
    const { root, steps } = await setup();
    root.querySelector<HTMLElement>('.jhead .link')!.click();
    expect(steps()).toEqual([
      [expect.stringContaining('Source'), 'false'],
      [expect.stringContaining('Checkout'), 'true'],
    ]);
  });

  it('starts the journey at the source, and shows where its values go when picked', async () => {
    const { root, steps } = await setup();
    const start = root.querySelector<HTMLElement>('.journey button')!;
    expect([...start.querySelectorAll('span, small, data')].map((e) => e.textContent)).toEqual([
      'direct / none',
      'Where this tab came from',
      '0 params',
      'All recorded',
    ]);
    start.click();
    expect(steps().map(([, pressed]) => pressed)).toEqual(['true', 'false', 'false']);
    const card = root.querySelector('.jpage')!;
    expect(card.querySelector('h3')!.textContent).toBe('direct / none');
    expect([...card.querySelectorAll('.jstats > div')].map((s) => s.textContent)).toEqual([
      'CapturedNone on the landing URL',
      'KeptNothing to keep',
      'CarriedNothing to carry',
      'On the orderAll recorded',
    ]);
  });
});
