import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { DOMObserver, type DOMChangeEvent } from '@/core/base/dom-observer';

/**
 * The observer's two directions are not symmetric, and these tests pin the
 * difference: an **added** element has to carry one of the filtered attributes to be
 * reported, a **removed** one does not.
 *
 * Removals are reported unfiltered because the observer is not the thing that knows
 * what was enhanced — `AttributeScanner` is, and it activates thirty selectors where
 * this filter watches eight (finding 164 in `docs/code-findings.md`).
 */

/** One MutationObserver microtask plus the observer's own 16ms throttle. */
async function flush(): Promise<void> {
  await new Promise(resolve => setTimeout(resolve, 40));
}

describe('DOMObserver removals', () => {
  let observer: DOMObserver | undefined;
  let events: DOMChangeEvent[];

  beforeEach(() => {
    document.body.innerHTML = '';
    events = [];
    observer = new DOMObserver();
    observer.addHandler(event => events.push(event));
    observer.start(document.body);
  });

  afterEach(() => {
    observer?.destroy();
    observer = undefined;
    document.body.innerHTML = '';
  });

  it('reports an element whose attribute is not in the filter', async () => {
    const el = document.createElement('div');
    el.setAttribute('data-next-action', 'add-to-cart');
    document.body.appendChild(el);
    await flush();

    el.remove();
    await flush();

    expect(
      events.filter(e => e.type === 'removed').map(e => e.element),
      'the handler owns the decision about what was enhanced, not the filter'
    ).toEqual([el]);
  });

  it('reports the wrapper that was removed, not the enhanced children inside it', async () => {
    const wrapper = document.createElement('div');
    const child = document.createElement('span');
    child.setAttribute('data-next-display', 'cart.itemCount');
    wrapper.appendChild(child);
    document.body.appendChild(wrapper);
    await flush();

    events.length = 0;
    wrapper.remove();
    await flush();

    expect(
      events.filter(e => e.type === 'removed').map(e => e.element),
      'walking the removed subtree is the handler’s job — it can do it without ' +
        'touching the DOM'
    ).toEqual([wrapper]);
  });

  it('says nothing about a subtree removed and re-attached in the same frame', async () => {
    const wrapper = document.createElement('div');
    const child = document.createElement('span');
    child.setAttribute('data-next-display', 'cart.itemCount');
    wrapper.appendChild(child);
    document.body.appendChild(wrapper);
    await flush();

    events.length = 0;
    wrapper.remove();
    document.body.appendChild(wrapper);
    await flush();

    expect(
      events.filter(e => e.type === 'removed'),
      'a re-render moved the node; it never left the document as far as the ' +
        'page is concerned'
    ).toEqual([]);
  });

  it('never reports a removed element as added', async () => {
    const el = document.createElement('span');
    el.setAttribute('data-next-display', 'cart.itemCount');
    document.body.appendChild(el);
    await flush();

    events.length = 0;
    el.remove();
    await flush();

    expect(
      events.map(e => e.type),
      'a removed element used to be queued as a pending *change* too, so it was ' +
        'announced as added one frame after it was announced as removed'
    ).toEqual(['removed']);
  });
});
