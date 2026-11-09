import { describe, expect, it } from 'vitest';
import { createDebug } from '../../../src/debug/state';
import { eventsView } from '../../../src/debug/tabs/events';
import { detailModal } from '../../../src/debug/ui/stream';
import { nodes } from '../../../src/debug/ui/view';
import { makeEngine } from '../../fixtures/engine';

describe('events tab', () => {
  it('writes an event’s total in the page’s language', async () => {
    const { engine } = makeEngine({ locale: 'de-DE', debug: true });
    await engine.start();
    const debug = engine.attach((ctx) =>
      createDebug(ctx, {
        at: Date.now(),
        path: '/',
        title: '/',
        kind: 'product',
        scope: 's1',
        funnel: 'f1',
        reload: false,
        reset: false,
        lines: [],
      }),
    );
    const events = eventsView(engine, debug, { open: new Set(), detail: detailModal(new Set()), render: () => {} });
    await engine.cart.addItem(2);
    await engine.cart.settled();
    const root = document.createElement('div');
    root.append(...nodes(events.view('cart.calculated')));
    expect(root.textContent).toMatch(/total 89,00\s\$/);
  });
});
