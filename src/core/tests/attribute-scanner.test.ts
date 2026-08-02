import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { AttributeScanner } from '@/core/attribute-scanner';
import { BaseEnhancer } from '@/core/base/base-enhancer';
import { useCartStore } from '@/state/cart';
import type { CartItem } from '@/types/global';

/**
 * `AttributeScanner.destroy()` used to tear down nothing at all: the only index of
 * live enhancers was a `WeakMap`, which cannot be iterated, so a full SDK teardown
 * left every enhancer subscribed and every listener it registered attached (finding
 * 154 in `docs/code-findings.md`). The per-instance teardown fixed underneath it —
 * `BaseDisplayEnhancer`'s `AbortController` (149) and `ProspectCartEnhancer`'s (139) —
 * only ever runs when something calls `destroy()` on the instance, and nothing did.
 *
 * These tests drive the scanner through a real enhancer (`CartDisplayEnhancer`, via
 * `data-next-display="cart.itemCount"`) and a real cart store, so "still alive" means
 * what it means on a page: the element keeps re-rendering when the cart changes.
 */

/** `<span data-next-display="cart.itemCount">`, appended to the body. */
function displayElement(id: string): HTMLElement {
  const el = document.createElement('span');
  el.id = id;
  el.setAttribute('data-next-display', 'cart.itemCount');
  document.body.appendChild(el);
  return el;
}

/** Drives the one store subscription `CartDisplayEnhancer` makes. */
function setCartItems(count: number): void {
  const items = Array.from({ length: count }, (_, i) => ({
    id: i + 1,
    packageId: i + 1,
    quantity: 1,
    price: 10,
    title: `Item ${i + 1}`,
    image: undefined,
    sku: undefined,
    is_upsell: undefined,
  })) as CartItem[];
  useCartStore.setState({ items, isEmpty: count === 0 });
}

/** The element's own destroy path: `BaseEnhancer` owns `destroy()` for every
 *  enhancer the scanner builds, so one spy sees them all. */
function elementIdOf(enhancer: BaseEnhancer): string {
  return (enhancer as unknown as { element: HTMLElement }).element.id;
}

/** A MutationObserver record is delivered as a microtask, and `DOMObserver`
 *  throttles its own notifications on a 16ms timer. */
async function flushDOMObserver(): Promise<void> {
  await new Promise(resolve => setTimeout(resolve, 40));
}

/** The observer's 16ms throttle *plus* the scanner's 50ms enhancement debounce —
 *  long enough for anything a removal could still set in motion to have run. */
async function flushEnhancementQueue(): Promise<void> {
  await new Promise(resolve => setTimeout(resolve, 120));
}

describe('AttributeScanner teardown', () => {
  let scanner: AttributeScanner | undefined;

  beforeEach(() => {
    document.body.innerHTML = '';
    useCartStore.getState().reset();
  });

  afterEach(() => {
    scanner?.destroy();
    scanner = undefined;
    vi.restoreAllMocks();
    useCartStore.getState().reset();
    document.body.innerHTML = '';
  });

  it('stops a destroyed page reacting to a store update', async () => {
    const el = displayElement('total');
    scanner = new AttributeScanner();
    await scanner.scanAndEnhance(document.body);

    setCartItems(2);
    expect(el.textContent, 'enhancer is live before destroy()').toBe('2');

    scanner.destroy();
    setCartItems(5);

    expect(
      el.textContent,
      'the enhancer kept its cart subscription after destroy() — the scanner ' +
        'never reached the instance'
    ).toBe('2');
  });

  it('reports no live enhancers after destroy()', async () => {
    displayElement('a');
    displayElement('b');
    scanner = new AttributeScanner();
    await scanner.scanAndEnhance(document.body);

    expect(scanner.getStats().enhancedElements).toBe(2);

    scanner.destroy();

    expect(scanner.getStats().enhancedElements).toBe(0);
  });

  it('tears down every other enhancer when one destroy() throws', async () => {
    const first = displayElement('first');
    displayElement('boom');
    const last = displayElement('last');

    scanner = new AttributeScanner();
    await scanner.scanAndEnhance(document.body);

    setCartItems(1);
    expect(first.textContent).toBe('1');
    expect(last.textContent).toBe('1');

    // Kept to call through with an explicit receiver below, never invoked bare.
    // eslint-disable-next-line @typescript-eslint/unbound-method
    const realDestroy = BaseEnhancer.prototype.destroy;
    const seen: string[] = [];
    vi.spyOn(BaseEnhancer.prototype, 'destroy').mockImplementation(function (
      this: BaseEnhancer
    ) {
      const id = elementIdOf(this);
      seen.push(id);
      if (id === 'boom') throw new Error('teardown exploded');
      realDestroy.call(this);
    });

    expect(() => scanner?.destroy()).not.toThrow();
    expect(seen.sort()).toEqual(['boom', 'first', 'last']);

    setCartItems(4);
    expect(
      [first.textContent, last.textContent],
      'a throwing teardown must not leave the enhancers after it running'
    ).toEqual(['1', '1']);
  });

  it('destroys each enhancer once, however many times destroy() is called', async () => {
    displayElement('once');
    scanner = new AttributeScanner();
    await scanner.scanAndEnhance(document.body);

    const destroySpy = vi.spyOn(BaseEnhancer.prototype, 'destroy');

    scanner.destroy();
    scanner.destroy();

    expect(destroySpy).toHaveBeenCalledTimes(1);
    expect(scanner.getStats().enhancedElements).toBe(0);
  });

  it('drops an element from the registry when it leaves the DOM', async () => {
    const el = displayElement('removed');
    scanner = new AttributeScanner();
    await scanner.scanAndEnhance(document.body);

    const destroySpy = vi.spyOn(BaseEnhancer.prototype, 'destroy');

    el.remove();
    await flushDOMObserver();
    expect(destroySpy, 'removal tears the enhancer down').toHaveBeenCalledTimes(
      1
    );

    scanner.destroy();
    expect(
      destroySpy,
      'destroy() re-destroyed an enhancer the DOM removal already cleaned up — ' +
        'the registry still held the element'
    ).toHaveBeenCalledTimes(1);
    expect(scanner.getStats().enhancedElements).toBe(0);
  });

  it('registers what a second scan enhances', async () => {
    const first = displayElement('first');
    scanner = new AttributeScanner();
    await scanner.scanAndEnhance(document.body);

    const second = displayElement('second');
    await scanner.scanAndEnhance(document.body);

    setCartItems(2);
    expect([first.textContent, second.textContent]).toEqual(['2', '2']);
    expect(
      scanner.getStats().enhancedElements,
      'the second scan must not re-enhance the element the first one did'
    ).toBe(2);

    scanner.destroy();
    setCartItems(7);
    expect([first.textContent, second.textContent]).toEqual(['2', '2']);
  });

  it('tears down an enhancer that finished building after destroy()', async () => {
    const el = displayElement('late');
    scanner = new AttributeScanner();

    // Not awaited: the scan is suspended on the dynamic `import()` inside
    // createEnhancer() when destroy() lands, so this enhancer is constructed
    // *after* the registry was emptied and can never be reached through it.
    const scan = scanner.scanAndEnhance(document.body);
    scanner.destroy();
    await scan;

    setCartItems(3);
    expect(
      el.textContent,
      'an enhancer built after destroy() must be torn down, not registered'
    ).toBe('0');
    expect(scanner.getStats().enhancedElements).toBe(0);
  });

  it('ignores a scan requested after destroy()', async () => {
    scanner = new AttributeScanner();
    scanner.destroy();

    const el = displayElement('after');
    await scanner.scanAndEnhance(document.body);

    setCartItems(2);
    expect(el.textContent, 'a destroyed scanner must enhance nothing').toBe('');
    expect(scanner.getStats().enhancedElements).toBe(0);
  });
});

/**
 * Removing a container has to take the features inside it with it (finding 164 in
 * `docs/code-findings.md`). Before this, `DOMObserver` reported only the node that
 * was removed, and only when that node itself carried one of the eight attributes it
 * filters on — so pulling out a wrapper `<div>` left every enhancer inside it
 * subscribed, listening and running timers for the rest of the page's life.
 *
 * These tests drive the real `MutationObserver`, so "cleaned up" means what it means
 * on a page: the element stops re-rendering when the cart changes.
 */
describe('AttributeScanner cleanup on removal', () => {
  let scanner: AttributeScanner | undefined;

  beforeEach(() => {
    document.body.innerHTML = '';
    useCartStore.getState().reset();
  });

  afterEach(() => {
    scanner?.destroy();
    scanner = undefined;
    vi.restoreAllMocks();
    useCartStore.getState().reset();
    document.body.innerHTML = '';
  });

  it('tears down an enhancer inside a removed wrapper', async () => {
    const wrapper = document.createElement('div');
    document.body.appendChild(wrapper);
    const el = document.createElement('span');
    el.id = 'inside';
    el.setAttribute('data-next-display', 'cart.itemCount');
    wrapper.appendChild(el);

    scanner = new AttributeScanner();
    await scanner.scanAndEnhance(document.body);

    setCartItems(2);
    expect(el.textContent, 'enhancer is live before the wrapper goes').toBe(
      '2'
    );

    wrapper.remove();
    await flushDOMObserver();

    setCartItems(5);
    expect(
      el.textContent,
      'the enhancer inside the removed wrapper kept its cart subscription'
    ).toBe('2');
    expect(scanner.getStats().enhancedElements).toBe(0);
  });

  it('tears down an element carrying an attribute the observer does not watch', async () => {
    const wrapper = document.createElement('div');
    wrapper.setAttribute('data-next-package-id', '5');
    document.body.appendChild(wrapper);
    const el = document.createElement('div');
    el.setAttribute('data-next-quantity-text', '{qty} Packs');
    wrapper.appendChild(el);

    scanner = new AttributeScanner();
    await scanner.scanAndEnhance(document.body);
    expect(
      scanner.getStats().enhancedElements,
      'data-next-quantity-text is one of the 30 the scanner activates'
    ).toBe(1);

    const destroySpy = vi.spyOn(BaseEnhancer.prototype, 'destroy');

    wrapper.remove();
    await flushDOMObserver();

    expect(
      destroySpy,
      'the removal walk must ask the scanner what it enhanced, not the ' +
        "observer's eight-attribute filter"
    ).toHaveBeenCalledTimes(1);
    expect(scanner.getStats().enhancedElements).toBe(0);
  });

  it('keeps the enhancer when a wrapper is removed and re-attached in the same frame', async () => {
    const wrapper = document.createElement('div');
    document.body.appendChild(wrapper);
    const el = document.createElement('span');
    el.setAttribute('data-next-display', 'cart.itemCount');
    wrapper.appendChild(el);

    scanner = new AttributeScanner();
    await scanner.scanAndEnhance(document.body);

    // A re-render: the subtree leaves and comes back inside one task, so nothing
    // ever observed it missing from the document.
    wrapper.remove();
    document.body.appendChild(wrapper);
    await flushEnhancementQueue();

    setCartItems(3);
    expect(
      el.textContent,
      're-attaching in the same frame must not leave the element inert'
    ).toBe('3');
    expect(scanner.getStats().enhancedElements).toBe(1);
  });

  it('does not re-enhance an element it just cleaned up', async () => {
    const el = displayElement('gone');
    scanner = new AttributeScanner();
    await scanner.scanAndEnhance(document.body);

    el.remove();
    await flushEnhancementQueue();

    expect(
      scanner.getStats().enhancedElements,
      'the removed element was queued for enhancement and came back into the ' +
        'registry detached, which is a leak the removal created'
    ).toBe(0);
  });

  it('destroys an enhancer inside a removed wrapper exactly once', async () => {
    const wrapper = document.createElement('div');
    document.body.appendChild(wrapper);
    const el = document.createElement('span');
    el.setAttribute('data-next-display', 'cart.itemCount');
    wrapper.appendChild(el);

    scanner = new AttributeScanner();
    await scanner.scanAndEnhance(document.body);

    const destroySpy = vi.spyOn(BaseEnhancer.prototype, 'destroy');

    wrapper.remove();
    await flushDOMObserver();
    expect(destroySpy).toHaveBeenCalledTimes(1);

    scanner.destroy();
    expect(
      destroySpy,
      'destroy() re-destroyed an enhancer the removal already cleaned up'
    ).toHaveBeenCalledTimes(1);
    expect(scanner.getStats().enhancedElements).toBe(0);
  });
});
