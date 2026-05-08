import { describe, it, expect, vi, beforeEach } from 'vitest';
import { setupQuantityControls } from '../quantityControls';

function makeHost(): HTMLElement {
  const host = document.createElement('div');
  host.innerHTML = `
    <button data-next-quantity-decrease>−</button>
    <span data-next-quantity-display></span>
    <button data-next-quantity-increase>+</button>
  `;
  document.body.appendChild(host);
  return host;
}

describe('setupQuantityControls', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('wires increase/decrease buttons and keeps the display in sync', () => {
    const host = makeHost();
    let qty = 1;
    const onChange = vi.fn();
    setupQuantityControls({
      hostEls: [host],
      getQty: () => qty,
      setQty: n => {
        qty = n;
      },
      min: 1,
      max: 10,
      onChange,
      handlers: new Map(),
    });

    const inc = host.querySelector<HTMLButtonElement>('[data-next-quantity-increase]')!;
    const dec = host.querySelector<HTMLButtonElement>('[data-next-quantity-decrease]')!;
    const display = host.querySelector<HTMLElement>('[data-next-quantity-display]')!;

    expect(display.textContent).toBe('1');
    expect(host.getAttribute('data-next-quantity')).toBe('1');

    inc.click();
    expect(qty).toBe(2);
    expect(display.textContent).toBe('2');
    expect(host.getAttribute('data-next-quantity')).toBe('2');
    expect(onChange).toHaveBeenCalledTimes(1);

    dec.click();
    expect(qty).toBe(1);
    expect(display.textContent).toBe('1');
    expect(onChange).toHaveBeenCalledTimes(2);
  });

  it('clamps at min — decrease is disabled and does not fire onChange', () => {
    const host = makeHost();
    let qty = 1;
    const onChange = vi.fn();
    setupQuantityControls({
      hostEls: [host],
      getQty: () => qty,
      setQty: n => {
        qty = n;
      },
      min: 1,
      max: 10,
      onChange,
      handlers: new Map(),
    });

    const dec = host.querySelector<HTMLButtonElement>('[data-next-quantity-decrease]')!;
    expect(dec.hasAttribute('disabled')).toBe(true);
    expect(dec.classList.contains('next-disabled')).toBe(true);

    dec.click();
    expect(qty).toBe(1);
    expect(onChange).not.toHaveBeenCalled();
  });

  it('clamps at max — increase is disabled at the ceiling', () => {
    const host = makeHost();
    let qty = 3;
    const onChange = vi.fn();
    setupQuantityControls({
      hostEls: [host],
      getQty: () => qty,
      setQty: n => {
        qty = n;
      },
      min: 1,
      max: 3,
      onChange,
      handlers: new Map(),
    });

    const inc = host.querySelector<HTMLButtonElement>('[data-next-quantity-increase]')!;
    expect(inc.hasAttribute('disabled')).toBe(true);

    inc.click();
    expect(qty).toBe(3);
    expect(onChange).not.toHaveBeenCalled();
  });

  it('stops event propagation so parent click handlers do not fire', () => {
    const host = makeHost();
    const parent = document.createElement('div');
    parent.appendChild(host);
    const parentClick = vi.fn();
    parent.addEventListener('click', parentClick);

    setupQuantityControls({
      hostEls: [host],
      getQty: () => 1,
      setQty: () => {},
      min: 1,
      max: 10,
      onChange: () => {},
      handlers: new Map(),
    });

    host.querySelector<HTMLButtonElement>('[data-next-quantity-increase]')!.click();
    expect(parentClick).not.toHaveBeenCalled();
  });

  it('registers handlers in the passed map for later cleanup', () => {
    const host = makeHost();
    const handlers = new Map<HTMLElement, (e: Event) => void>();
    setupQuantityControls({
      hostEls: [host],
      getQty: () => 1,
      setQty: () => {},
      min: 1,
      max: 10,
      onChange: () => {},
      handlers,
    });

    const inc = host.querySelector<HTMLButtonElement>('[data-next-quantity-increase]')!;
    const dec = host.querySelector<HTMLButtonElement>('[data-next-quantity-decrease]')!;
    expect(handlers.has(inc)).toBe(true);
    expect(handlers.has(dec)).toBe(true);
  });

  it('aggregates stepper controls across multiple hostEls', () => {
    const internal = makeHost();
    const external = document.createElement('div');
    external.innerHTML = `
      <button data-next-quantity-increase>+</button>
      <span data-next-quantity-display></span>
    `;
    document.body.appendChild(external);

    let qty = 1;
    setupQuantityControls({
      hostEls: [internal, external],
      getQty: () => qty,
      setQty: n => {
        qty = n;
      },
      min: 1,
      max: 10,
      onChange: () => {},
      handlers: new Map(),
    });

    // Click the external increase button — both displays should update
    external.querySelector<HTMLButtonElement>('[data-next-quantity-increase]')!.click();
    expect(qty).toBe(2);
    expect(internal.querySelector('[data-next-quantity-display]')!.textContent).toBe('2');
    expect(external.querySelector('[data-next-quantity-display]')!.textContent).toBe('2');
  });
});
