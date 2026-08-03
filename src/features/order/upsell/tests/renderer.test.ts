import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  renderQuantityDisplay,
  renderQuantityToggles,
  renderProcessingState,
  showUpsellOffer,
  hideUpsellOffer,
  renderSuccess,
  renderError,
  syncOptionSelectionAcrossContainers,
} from '../upsell.renderer';

const logger = { debug: vi.fn(), warn: vi.fn(), error: vi.fn(), info: vi.fn() } as any;

afterEach(() => {
  document.body.innerHTML = '';
  vi.clearAllMocks();
});

describe('renderProcessingState', () => {
  it('disables buttons and flags the element while processing', () => {
    const el = document.createElement('div');
    const btn = document.createElement('button');
    renderProcessingState(el, [btn], true);
    expect(el.classList.contains('next-processing')).toBe(true);
    expect(btn.disabled).toBe(true);
    expect(btn.classList.contains('next-disabled')).toBe(true);
  });

  it('re-enables when processing ends', () => {
    const el = document.createElement('div');
    const btn = document.createElement('button');
    renderProcessingState(el, [btn], true);
    renderProcessingState(el, [btn], false);
    expect(el.classList.contains('next-processing')).toBe(false);
    expect(btn.disabled).toBe(false);
  });
});

describe('show/hideUpsellOffer', () => {
  it('shows the offer as available', () => {
    const el = document.createElement('div');
    el.classList.add('next-hidden');
    showUpsellOffer(el);
    expect(el.classList.contains('next-available')).toBe(true);
    expect(el.classList.contains('next-hidden')).toBe(false);
  });

  it('hides the offer', () => {
    const el = document.createElement('div');
    el.classList.add('next-available');
    hideUpsellOffer(el);
    expect(el.classList.contains('next-hidden')).toBe(true);
    expect(el.classList.contains('next-available')).toBe(false);
  });
});

describe('renderSuccess / renderError', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('flashes success then clears it', () => {
    const el = document.createElement('div');
    renderSuccess(el);
    expect(el.classList.contains('next-success')).toBe(true);
    vi.advanceTimersByTime(3000);
    expect(el.classList.contains('next-success')).toBe(false);
  });

  it('shows an error, clears processing, logs, then clears the error', () => {
    const el = document.createElement('div');
    el.classList.add('next-processing');
    renderError(el, 'nope', logger);
    expect(el.classList.contains('next-error')).toBe(true);
    expect(el.classList.contains('next-processing')).toBe(false);
    expect(logger.error).toHaveBeenCalledWith('Upsell error:', 'nope');
    vi.advanceTimersByTime(5000);
    expect(el.classList.contains('next-error')).toBe(false);
  });
});

describe('renderQuantityDisplay', () => {
  it('shows the fallback quantity when no selector is tracked', () => {
    const el = document.createElement('div');
    el.innerHTML = '<span data-next-upsell-quantity="display"></span>';
    renderQuantityDisplay(el, undefined, new Map(), 3);
    expect(el.querySelector('[data-next-upsell-quantity="display"]')!.textContent).toBe('3');
  });

  it('shows the tracked quantity for a selector', () => {
    const el = document.createElement('div');
    el.innerHTML = '<span data-next-upsell-quantity="display"></span>';
    renderQuantityDisplay(el, 's1', new Map([['s1', 5]]), 1);
    expect(el.querySelector('[data-next-upsell-quantity="display"]')!.textContent).toBe('5');
  });
});

describe('renderQuantityToggles', () => {
  it('marks the toggle matching the current quantity', () => {
    const el = document.createElement('div');
    el.innerHTML = `
      <button data-next-upsell-quantity-toggle="1"></button>
      <button data-next-upsell-quantity-toggle="2"></button>`;
    renderQuantityToggles(el, 2);
    const toggles = el.querySelectorAll('[data-next-upsell-quantity-toggle]');
    expect(toggles[0]!.classList.contains('next-selected')).toBe(false);
    expect(toggles[1]!.classList.contains('next-selected')).toBe(true);
  });
});

describe('syncOptionSelectionAcrossContainers', () => {
  it('selects the matching option in every container for the selector', () => {
    document.body.innerHTML = `
      <div data-next-selector-id="s1">
        <div data-next-upsell-option data-next-package-id="10"></div>
        <div data-next-upsell-option data-next-package-id="20"></div>
      </div>`;
    syncOptionSelectionAcrossContainers('s1', 20);
    const opts = document.querySelectorAll('[data-next-upsell-option]');
    expect(opts[0]!.getAttribute('data-next-selected')).toBe('false');
    expect(opts[1]!.getAttribute('data-next-selected')).toBe('true');
    expect(opts[1]!.classList.contains('next-selected')).toBe(true);
  });
});
