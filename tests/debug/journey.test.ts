import { describe, expect, it, vi } from 'vitest';
import { journeyView } from '../../src/debug/journey';
import { createDebug, type PageKind } from '../../src/debug/state';
import { detailModal } from '../../src/debug/stream';
import { nodes } from '../../src/debug/view';
import { makeEngine } from '../fixtures/engine';
import { MemoryStorage } from '../fixtures/storage';

const visit = (session: Storage, path: string, kind: PageKind, storagePrefix?: string) => {
  const { engine } = makeEngine({ session, debug: true, storagePrefix });
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
  const show = vi.fn();
  const detail = detailModal(new Set());
  document.body.append(detail.dialog);
  const view = journeyView(engine, debug, { render: () => paint(), show, detail, issues: () => 0 });
  const paint = () => root.replaceChildren(...nodes(view.view()));
  paint();
  const blocks = () =>
    [...root.querySelectorAll<HTMLDetailsElement>('.jline > .jpg')].map((b) => [
      b.querySelector('.jkind')!.textContent,
      b.dataset.state,
      b.open,
    ]);
  const block = (nth: number) => root.querySelectorAll<HTMLDetailsElement>('.jline > .jpg')[nth]!;
  return { engine, root, show, detail, blocks, block };
}

describe('journey tab', () => {
  it('sums up the visit and draws one timeline: the source, then each page with what it held', async () => {
    const { root, blocks, block } = await setup();
    expect(root.querySelector('.jsum')!.textContent).toBe(
      'direct / none → Landing → Checkout1 item · $49.00 · no order yetClear',
    );
    expect(blocks()).toEqual([
      ['Direct', 'done', false],
      ['Landing', 'done', true],
      ['Checkout', 'now', true],
    ]);
    const now = block(2);
    expect(now.querySelector('.jtitle')!.textContent).toBe('Checkout/checkout/Now');
    expect(now.querySelector('.jright')!.textContent).toMatch(/^1 item · \$49\.00\d\d:\d\d:\d\d · now$/);
    expect(now.querySelector('.jpath')!.textContent).toBe('/checkout/ · storage s1');
    expect(root.querySelector('.jcarry')!.textContent).toBe('↓ Cart carried over');
  });

  it('lists what happened on each page as one line each, and counts its tracking events', async () => {
    const { block, show } = await setup();
    const landing = block(1);
    expect(
      [...landing.querySelectorAll('.jmom')].map((m) => [m.children[1]!.textContent, m.getAttribute('data-tone')]),
    ).toEqual([['Added Earbuds ×1 ×1', null]]);
    expect(landing.querySelector('.jnote:last-child')!.textContent).toBe('0 tracking events sent');
    expect(block(2).querySelector('.jmoms')!.textContent).toBe('Nothing happened to the cart here.');
    expect(show).not.toHaveBeenCalled();
  });

  it('clears the journey down to this page', async () => {
    const { root, blocks } = await setup();
    [...root.querySelectorAll<HTMLButtonElement>('.jsum .link')].find((b) => b.textContent === 'Clear')!.click();
    expect(blocks().map(([k]) => k)).toEqual(['Direct', 'Checkout']);
  });

  it('starts at the source with its checks, and opens where its values go', async () => {
    const { block, detail } = await setup();
    const source = block(0);
    expect(source.querySelector('.jtitle')!.textContent).toBe('Directdirect / none');
    expect([...source.querySelectorAll('.jchecks > span')].map((c) => c.textContent)).toEqual([
      '– Captured: None on the landing URL',
      '– Kept: Nothing to keep',
      '– Carried: Nothing to carry',
      '✓ On the order: All recorded',
    ]);
    source.querySelector<HTMLButtonElement>('.jchecks .link')!.click();
    expect(detail.dialog.open).toBe(true);
    expect(detail.dialog.querySelector('h2')!.textContent).toBe('Source');
    expect(detail.dialog.querySelector('.jpage h3')!.textContent).toBe('direct / none');
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
    const view = journeyView(engine, debug, {
      render: () => {},
      show,
      detail: detailModal(new Set()),
      issues: () => 1,
    });
    root.replaceChildren(...nodes(view.view()));
    const carry = root.querySelector<HTMLElement>('.jcarry')!;
    expect([carry.textContent, carry.dataset.tone]).toEqual([
      '⚠ The cart (1 item) did not carry over from /landing/',
      'error',
    ]);
    expect(root.querySelectorAll<HTMLElement>('.jline > .jpg')[2]!.dataset.state).toBe('now');
    const issuesLink = [...root.querySelectorAll<HTMLButtonElement>('.jsum .link')].find((b) =>
      b.textContent!.startsWith('⚠'),
    )!;
    expect(issuesLink.textContent).toBe('⚠ 1 issue');
    issuesLink.click();
    expect(show).toHaveBeenCalledWith('issues');
  });
});
