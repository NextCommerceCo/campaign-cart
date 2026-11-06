import { describe, expect, it, vi } from 'vitest';
import { journeyView } from '../../src/debug/journey';
import { createDebug, type PageKind } from '../../src/debug/state';
import { detailModal } from '../../src/debug/stream';
import { nodes } from '../../src/debug/view';
import { publicOrder } from '../../src/engine/order';
import type { ApiOrder } from '../../src/engine/types';
import { makeEngine } from '../fixtures/engine';
import { MemoryStorage } from '../fixtures/storage';

const visit = (session: Storage, path: string, kind: PageKind, storagePrefix?: string, reload = false) => {
  const { engine } = makeEngine({ session, debug: true, storagePrefix });
  const debug = engine.attach((ctx) =>
    createDebug(ctx, {
      at: Date.now(),
      path,
      title: path,
      kind,
      scope: 's1',
      reload,
      reset: false,
      lines: engine.cart.lines(),
    }),
  );
  return { engine, debug };
};

async function setup(extra?: (session: Storage) => Promise<void>) {
  vi.spyOn(console, 'debug').mockImplementation(() => {});
  const session = new MemoryStorage();
  const landing = visit(session, '/landing/', 'product');
  await landing.engine.start();
  await landing.engine.cart.addItem(1);
  await extra?.(session);
  const { engine, debug } = visit(session, '/checkout/', 'checkout');
  await engine.start();
  await engine.cart.settled();
  const root = document.createElement('div');
  const show = vi.fn();
  const detail = detailModal(new Set());
  document.body.append(detail.dialog);
  const view = journeyView(engine, debug, { render: () => paint(), show, detail, issues: () => 0 });
  const paint = () => root.replaceChildren(...nodes(view.view()));
  paint();
  const steps = () =>
    [...root.querySelectorAll<HTMLElement>('.journey > ol > li')].map((li) => [
      li.querySelector('header')!.textContent,
      li.querySelector('ul > li')!.textContent,
    ]);
  const row = (nth: number) => root.querySelectorAll<HTMLButtonElement>('.journey > ol > li button')[nth]!;
  return { engine, root, show, detail, steps, row };
}

describe('journey tab', () => {
  it('sums up the visit and draws it as a tsugi journey: the entry, then each page with what it held', async () => {
    const { root, steps, row } = await setup();
    expect(root.querySelector('.jsum')!.textContent).toBe('1 item · $49.00 · no order yet · 2 pagesClear');
    expect(root.querySelector<HTMLElement>('.journey')!.dataset.orientation).toBe('vertical');
    expect(steps()).toEqual([
      ['EntryDirect', expect.stringMatching(/^direct \/ noneWhere this tab came fromDetails\d\d:\d\d:\d\d$/)],
      [
        expect.stringMatching(/^Step 1Landing\d+s$/),
        expect.stringMatching(/^\/landing\/\/landing\/1 item · \$49\.00\d\d:\d\d:\d\d$/),
      ],
      ['Step 2CheckoutNow', expect.stringMatching(/^\/checkout\/\/checkout\/1 item · \$49\.00\d\d:\d\d:\d\d$/)],
    ]);
    expect([row(0), row(1), row(2)].map((b) => b.getAttribute('aria-pressed'))).toEqual(['true', 'true', 'true']);
  });

  it('opens a page with what happened there, what carried over and its tracking events', async () => {
    const { row, detail, show } = await setup();
    row(1).click();
    expect(detail.dialog.open).toBe(true);
    expect(detail.dialog.querySelector('h2')!.textContent).toBe('/landing/');
    expect(detail.dialog.querySelector('header p')!.textContent).toMatch(/^Step 1 · Landing · \d\d:\d\d:\d\d · \d+s$/);
    expect(
      [...detail.dialog.querySelectorAll('.jmom')].map((m) => [
        m.children[1]!.textContent,
        m.getAttribute('data-tone'),
      ]),
    ).toEqual([['Added Earbuds ×1 ×1', null]]);
    expect(detail.dialog.querySelector('.jnote')!.textContent).toBe('0 tracking events sent');
    row(2).click();
    expect(detail.dialog.querySelector('.jcarry')!.textContent).toBe('↓ Cart carried over');
    expect([...detail.dialog.querySelectorAll('.jnote')].map((n) => n.textContent)).toEqual([
      'Nothing happened to the cart here.',
      '0 tracking events sent',
    ]);
    expect(show).not.toHaveBeenCalled();
  });

  it('clears the journey down to this page', async () => {
    const { root, steps } = await setup();
    [...root.querySelectorAll<HTMLButtonElement>('.jsum .link')].find((b) => b.textContent === 'Clear')!.click();
    expect(steps().map(([header]) => header)).toEqual(['EntryDirect', 'Step 1CheckoutNow']);
  });

  it('badges a reloaded page in its step heading', async () => {
    const { root } = await setup(async (session) => {
      visit(session, '/landing/', 'product', undefined, true);
      visit(session, '/landing/', 'product', undefined, true);
    });
    expect(root.querySelectorAll('.journey > ol > li header')[1]!.textContent).toMatch(
      /^Step 1Landing\d+sReloaded ×2$/,
    );
  });

  it('opens the entry with where its values go', async () => {
    const { row, detail } = await setup();
    row(0).click();
    expect(detail.dialog.querySelector('h2')!.textContent).toBe('Source');
    expect(detail.dialog.querySelector('.jpage h3')!.textContent).toBe('direct / none');
  });

  it('badges what each step added to the order, an upsell with its outcome, as a page like the others', async () => {
    const order = (total: string) =>
      publicOrder({ ref_id: 'R1', number: 1001, total_incl_tax: total, currency: 'USD' } as ApiOrder);
    const { root, steps } = await setup(async (session) => {
      const upsell = visit(session, '/upsell/', 'upsell');
      await upsell.engine.start();
      upsell.engine.events.emit('order.loaded', order('49.00'));
      upsell.engine.events.emit('upsell.accepted', {
        ref_id: 'R1',
        page: '/upsell/',
        lines: [{ package_id: 2, quantity: 1 }],
      });
      upsell.engine.events.emit('order.updated', order('68.50'));
      const declined = visit(session, '/declined/', 'upsell');
      await declined.engine.start();
      declined.engine.events.emit('upsell.skipped', { ref_id: 'R1', page: '/declined/', lines: [] });
    });
    expect(steps().slice(2, 4)).toEqual([
      [
        expect.stringMatching(/^Step 2Upsell\d+sAccepted \+\$19\.50/),
        expect.stringMatching(/^\/upsell\/\/upsell\/Order R1 · \$68\.50/),
      ],
      [expect.stringMatching(/^Step 3Upsell\d+sDeclined/), expect.stringMatching(/^\/declined\/\/declined\//)],
    ]);
    expect(root.querySelector('.journey [data-outcomes]')).toBeNull();
    expect(root.querySelector('.jsum')!.textContent).toContain(' · upsells +$19.50');
  });

  it('joins each page to the next with a line, as tsugi draws it', async () => {
    const observed: Array<() => void> = [];
    vi.stubGlobal(
      'ResizeObserver',
      class {
        constructor(private fn: () => void) {}
        observe() {
          observed.push(this.fn);
        }
        disconnect() {}
      },
    );
    const { root } = await setup();
    observed.at(-1)!();
    expect(root.querySelectorAll('.journey > svg path')).toHaveLength(2);
    vi.unstubAllGlobals();
  });

  it('marks a cart that did not carry over between the pages, and links the issues', async () => {
    vi.spyOn(console, 'debug').mockImplementation(() => {});
    const session = new MemoryStorage();
    const landing = visit(session, '/landing/', 'product');
    await landing.engine.start();
    await landing.engine.cart.addItem(1);
    const { engine, debug } = visit(session, '/checkout/', 'checkout', 'next:other');
    await engine.start();
    const root = document.createElement('div');
    const show = vi.fn();
    const detail = detailModal(new Set());
    const view = journeyView(engine, debug, { render: () => {}, show, detail, issues: () => 1 });
    root.replaceChildren(...nodes(view.view()));
    const step = root.querySelectorAll<HTMLElement>('.journey > ol > li')[2]!;
    expect(step.querySelector('header')!.textContent).toBe('Step 2CheckoutNow1 issue');
    expect(step.querySelector<HTMLElement>('header .badge:last-child')!.dataset.variant).toBe('destructive');
    const now = step.querySelector<HTMLButtonElement>('button')!;
    expect(now.querySelector('span')!.textContent).toBe('/checkout/');
    now.click();
    const carry = detail.dialog.querySelector<HTMLElement>('.jcarry')!;
    expect([carry.textContent, carry.dataset.tone]).toEqual([
      '⚠ The cart (1 item) did not carry over from /landing/',
      'error',
    ]);
    const issuesLink = [...root.querySelectorAll<HTMLButtonElement>('.jsum .link')].find((b) =>
      b.textContent!.startsWith('⚠'),
    )!;
    expect(issuesLink.textContent).toBe('⚠ 1 issue');
    issuesLink.click();
    expect(show).toHaveBeenCalledWith('issues');
  });
});
