/**
 * `ProductDisplayEnhancer` registers a *second* `document` listener for
 * `next:currency-changed` on top of the one `BaseDisplayEnhancer` registers — its own
 * reloads the package data so the new currency's prices are read before the re-render.
 * Both used to be inline arrows with no teardown path (finding 149 in
 * `docs/code-findings.md`), so a destroyed price display kept re-rendering forever.
 *
 * These tests pin the reload behaviour while the enhancer is alive and its absence
 * after `destroy()`.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ProductDisplayEnhancer } from '@/features/display/product-display';
import { DisplayContextProvider } from '@/features/display/display-core';
import { useCampaignStore } from '@/state/campaign';
import { useCartStore } from '@/state/cart';

vi.mock('@/state/campaign');
vi.mock('@/state/cart');

/** Repoints the mocked campaign store at a new package list, the way a currency
 *  switch repoints it at prices in the new currency. */
function setPackages(packages: unknown[]): void {
  const state = { packages, data: { packages } };
  (useCampaignStore as any).getState = vi.fn(() => state);
  (useCampaignStore as any).subscribe = vi.fn(() => () => {});
}

function mockCartStore(): void {
  const state = { items: [], isEmpty: true, vouchers: [] };
  (useCartStore as any).getState = vi.fn(() => state);
  (useCartStore as any).subscribe = vi.fn(() => () => {});
}

function createElement(displayPath: string): HTMLElement {
  const element = document.createElement('div');
  element.setAttribute('data-next-display', displayPath);
  document.body.appendChild(element);
  return element;
}

const fireCurrencyChanged = async (): Promise<void> => {
  document.dispatchEvent(new CustomEvent('next:currency-changed'));
  // The enhancer's own handler is async; let its microtasks settle.
  await Promise.resolve();
};

describe('ProductDisplayEnhancer currency-change listener', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    DisplayContextProvider.clearAll();
    mockCartStore();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('reloads package data and re-renders while alive', async () => {
    setPackages([{ ref_id: 1, name: 'Product 1', price: '99.99' }]);
    const element = createElement('package.1.price');
    const enhancer = new ProductDisplayEnhancer(element);
    await enhancer.initialize();
    expect(element.textContent).toBe('$99.99');

    // Same package, new price — only the enhancer's own listener re-reads it.
    setPackages([{ ref_id: 1, name: 'Product 1', price: '149.99' }]);
    await fireCurrencyChanged();

    expect(element.textContent).toBe('$149.99');
  });

  it('stops reacting once destroyed', async () => {
    setPackages([{ ref_id: 1, name: 'Product 1', price: '99.99' }]);
    const element = createElement('package.1.price');
    const enhancer = new ProductDisplayEnhancer(element);
    await enhancer.initialize();

    enhancer.destroy();
    setPackages([{ ref_id: 1, name: 'Product 1', price: '149.99' }]);
    await fireCurrencyChanged();

    expect(element.textContent).toBe('$99.99');
  });
});
