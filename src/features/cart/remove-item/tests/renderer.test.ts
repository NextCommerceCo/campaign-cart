import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  renderButtonState,
  renderCartClasses,
  renderQuantityData,
  renderButtonContent,
  renderRemovalFeedback,
} from '../remove-item.renderer';

describe('renderButtonState', () => {
  it('disables the button when the item is not in the cart', () => {
    const el = document.createElement('button');
    renderButtonState(el, false);
    expect(el.classList.contains('disabled')).toBe(true);
    expect(el.hasAttribute('disabled')).toBe(true);
    expect(el.getAttribute('aria-disabled')).toBe('true');
  });

  it('enables the button when the item is in the cart', () => {
    const el = document.createElement('button');
    renderButtonState(el, true);
    expect(el.classList.contains('disabled')).toBe(false);
    expect(el.getAttribute('aria-disabled')).toBe('false');
  });
});

describe('renderCartClasses', () => {
  it('reflects in-cart and empty states', () => {
    const el = document.createElement('div');
    renderCartClasses(el, true);
    expect(el.classList.contains('has-item')).toBe(true);
    renderCartClasses(el, false);
    expect(el.classList.contains('empty')).toBe(true);
    expect(el.classList.contains('has-item')).toBe(false);
  });
});

describe('renderQuantityData', () => {
  it('writes quantity and in-cart data attributes', () => {
    const el = document.createElement('div');
    renderQuantityData(el, 4, true);
    expect(el.getAttribute('data-quantity')).toBe('4');
    expect(el.getAttribute('data-in-cart')).toBe('true');
  });
});

describe('renderButtonContent', () => {
  it('interpolates {quantity} and preserves the original template', () => {
    const el = document.createElement('button');
    el.innerHTML = 'Remove ({quantity})';
    renderButtonContent(el, 3);
    expect(el.innerHTML).toBe('Remove (3)');
    renderButtonContent(el, 5);
    expect(el.innerHTML).toBe('Remove (5)');
  });
});

describe('renderRemovalFeedback', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('adds feedback classes then clears them after the animation', () => {
    const wrapper = document.createElement('div');
    wrapper.className = 'cart-item';
    const btn = document.createElement('button');
    wrapper.appendChild(btn);

    renderRemovalFeedback(btn);
    expect(btn.classList.contains('item-removed')).toBe(true);
    expect(wrapper.classList.contains('removing')).toBe(true);

    vi.advanceTimersByTime(300);
    expect(btn.classList.contains('item-removed')).toBe(false);
    expect(wrapper.classList.contains('removing')).toBe(false);
  });
});
