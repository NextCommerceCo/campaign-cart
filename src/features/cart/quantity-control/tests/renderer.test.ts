import { describe, it, expect, beforeEach } from 'vitest';
import {
  renderButtonState,
  renderInputValue,
  renderCartClasses,
  renderQuantityData,
  renderButtonContent,
} from '../quantity-control.renderer';
import type { QuantityConstraints } from '../quantity-control.types';

const constraints: QuantityConstraints = { min: 1, max: 5, step: 1 };

describe('renderButtonState', () => {
  it('disables the increase button at max', () => {
    const el = document.createElement('button');
    renderButtonState(el, 'increase', 5, constraints);
    expect(el.classList.contains('disabled')).toBe(true);
    expect(el.hasAttribute('disabled')).toBe(true);
    expect(el.getAttribute('aria-disabled')).toBe('true');
  });

  it('enables the increase button below max', () => {
    const el = document.createElement('button');
    renderButtonState(el, 'increase', 3, constraints);
    expect(el.classList.contains('disabled')).toBe(false);
    expect(el.getAttribute('aria-disabled')).toBe('false');
  });

  it('disables the decrease button at min', () => {
    const el = document.createElement('button');
    renderButtonState(el, 'decrease', 1, constraints);
    expect(el.hasAttribute('disabled')).toBe(true);
  });

  it('sets min/max/step on a set input without disabling it', () => {
    const el = document.createElement('input');
    renderButtonState(el, 'set', 2, constraints);
    expect(el.min).toBe('1');
    expect(el.max).toBe('5');
    expect(el.step).toBe('1');
    expect(el.hasAttribute('disabled')).toBe(false);
  });
});

describe('renderInputValue', () => {
  it('writes the quantity when it differs', () => {
    const el = document.createElement('input');
    el.value = '2';
    renderInputValue(el, 4);
    expect(el.value).toBe('4');
  });

  it('leaves the value untouched when already equal', () => {
    const el = document.createElement('input');
    el.value = '3';
    renderInputValue(el, 3);
    expect(el.value).toBe('3');
  });
});

describe('renderCartClasses', () => {
  it('marks in-cart state', () => {
    const el = document.createElement('div');
    renderCartClasses(el, true);
    expect(el.classList.contains('has-item')).toBe(true);
    expect(el.classList.contains('empty')).toBe(false);
  });

  it('marks empty state', () => {
    const el = document.createElement('div');
    renderCartClasses(el, false);
    expect(el.classList.contains('empty')).toBe(true);
    expect(el.classList.contains('has-item')).toBe(false);
  });
});

describe('renderQuantityData', () => {
  it('writes quantity and in-cart data attributes', () => {
    const el = document.createElement('div');
    renderQuantityData(el, 3, true);
    expect(el.getAttribute('data-quantity')).toBe('3');
    expect(el.getAttribute('data-in-cart')).toBe('true');
  });
});

describe('renderButtonContent', () => {
  let el: HTMLElement;
  beforeEach(() => {
    el = document.createElement('button');
  });

  it('interpolates {quantity} and {step} from the original template', () => {
    el.innerHTML = 'Add {quantity} (of {step})';
    renderButtonContent(el, 2, 3);
    expect(el.innerHTML).toBe('Add 2 (of 3)');
  });

  it('preserves the original template so later renders re-interpolate', () => {
    el.innerHTML = 'Qty: {quantity}';
    renderButtonContent(el, 2, 1);
    expect(el.getAttribute('data-original-content')).toBe('Qty: {quantity}');
    renderButtonContent(el, 5, 1);
    expect(el.innerHTML).toBe('Qty: 5');
  });

  it('is a no-op when content without tokens is unchanged', () => {
    el.innerHTML = 'Add to cart';
    renderButtonContent(el, 2, 1);
    expect(el.innerHTML).toBe('Add to cart');
  });
});
