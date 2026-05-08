import { describe, it, expect } from 'vitest';
import { applySlotConditionals } from '../BundleSelectorEnhancer.conditions';

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('applySlotConditionals', () => {
  it('shows element when data-next-show var is "show"', () => {
    const root = document.createElement('div');
    root.innerHTML = '<span data-next-show="item.hasDiscount">Discount!</span>';
    applySlotConditionals(root, { 'item.hasDiscount': 'show' });
    const span = root.querySelector('span')!;
    expect(span.style.display).not.toBe('none');
    expect(span.hasAttribute('data-next-show')).toBe(false);
  });

  it('hides element when data-next-show var is "hide"', () => {
    const root = document.createElement('div');
    root.innerHTML = '<span data-next-show="item.hasDiscount">Discount!</span>';
    applySlotConditionals(root, { 'item.hasDiscount': 'hide' });
    expect(root.querySelector('span')!.style.display).toBe('none');
  });

  it('shows element when data-next-show var is "true"', () => {
    const root = document.createElement('div');
    root.innerHTML = '<span data-next-show="item.isRecurring">Recurring</span>';
    applySlotConditionals(root, { 'item.isRecurring': 'true' });
    expect(root.querySelector('span')!.style.display).not.toBe('none');
  });

  it('hides element when data-next-show var is "false"', () => {
    const root = document.createElement('div');
    root.innerHTML = '<span data-next-show="item.isRecurring">Recurring</span>';
    applySlotConditionals(root, { 'item.isRecurring': 'false' });
    expect(root.querySelector('span')!.style.display).toBe('none');
  });

  it('hides element when data-next-show var is empty string', () => {
    const root = document.createElement('div');
    root.innerHTML = '<span data-next-show="item.interval">Billing</span>';
    applySlotConditionals(root, { 'item.interval': '' });
    expect(root.querySelector('span')!.style.display).toBe('none');
  });

  it('hides element when data-next-hide var is "true"', () => {
    const root = document.createElement('div');
    root.innerHTML = '<span data-next-hide="item.isRecurring">One-time</span>';
    applySlotConditionals(root, { 'item.isRecurring': 'true' });
    expect(root.querySelector('span')!.style.display).toBe('none');
  });

  it('shows element when data-next-hide var is "false"', () => {
    const root = document.createElement('div');
    root.innerHTML = '<span data-next-hide="item.isRecurring">One-time</span>';
    applySlotConditionals(root, { 'item.isRecurring': 'false' });
    expect(root.querySelector('span')!.style.display).not.toBe('none');
  });

  it('shows element when data-next-hide var is "hide"', () => {
    const root = document.createElement('div');
    root.innerHTML = '<span data-next-hide="item.hasDiscount">No discount</span>';
    applySlotConditionals(root, { 'item.hasDiscount': 'hide' });
    expect(root.querySelector('span')!.style.display).not.toBe('none');
  });

  it('does not touch elements whose attribute value is not in vars', () => {
    const root = document.createElement('div');
    root.innerHTML = '<span data-next-show="cart.hasCoupon">Coupon!</span>';
    applySlotConditionals(root, { 'item.hasDiscount': 'show' });
    const span = root.querySelector('span')!;
    expect(span.style.display).toBe('');
    expect(span.hasAttribute('data-next-show')).toBe(true);
  });

  it('handles multiple conditional elements in a single root', () => {
    const root = document.createElement('div');
    root.innerHTML = `
      <span data-next-show="item.hasDiscount">Discount</span>
      <span data-next-hide="item.isRecurring">One-time</span>
    `;
    applySlotConditionals(root, {
      'item.hasDiscount': 'show',
      'item.isRecurring': 'true',
    });
    const spans = root.querySelectorAll('span');
    expect(spans[0].style.display).not.toBe('none');
    expect(spans[1].style.display).toBe('none');
  });

  it('removes processed attributes to prevent ConditionalDisplayEnhancer conflict', () => {
    const root = document.createElement('div');
    root.innerHTML = `
      <span data-next-show="item.hasDiscount">Discount</span>
      <span data-next-hide="item.isRecurring">One-time</span>
      <span data-next-show="cart.hasCoupon">Coupon</span>
    `;
    applySlotConditionals(root, {
      'item.hasDiscount': 'show',
      'item.isRecurring': 'false',
    });
    const spans = root.querySelectorAll('span');
    // Slot vars: attributes removed
    expect(spans[0].hasAttribute('data-next-show')).toBe(false);
    expect(spans[1].hasAttribute('data-next-hide')).toBe(false);
    // Store path: attribute preserved
    expect(spans[2].hasAttribute('data-next-show')).toBe(true);
  });
});
