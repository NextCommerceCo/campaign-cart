import { describe, it, expect, vi, beforeEach } from 'vitest';

import type { Logger } from '@/core/logger';

import {
  hideLoading,
  showLoading,
  updateProgress,
  type LoadingStateContext,
} from '../loading-state';

// Kept as a plain object (not typed as `Logger`) so `logger.warn` stays a `Mock` in
// assertions — going through `ctx.logger.warn` would carry `Logger`'s method signature
// and trip `@typescript-eslint/unbound-method`.
function createMockLogger() {
  return { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() };
}

function createCtx(html = ''): LoadingStateContext {
  const form = document.createElement('form');
  form.innerHTML = html;
  document.body.appendChild(form);
  return {
    form,
    loadingStates: new Map(),
    logger: createMockLogger() as unknown as Logger,
  };
}

beforeEach(() => {
  document.body.innerHTML = '';
});

describe('showLoading', () => {
  it('marks the form busy and the named section with it', () => {
    const ctx = createCtx('<div data-section="checkout"></div>');

    showLoading(ctx, 'checkout');

    expect(ctx.form.classList.contains('next-processing')).toBe(true);
    expect(
      ctx.form
        .querySelector('[data-section="checkout"]')
        ?.classList.contains('next-loading')
    ).toBe(true);
  });

  it('marks the form busy even when no section element exists', () => {
    const ctx = createCtx();

    showLoading(ctx, 'shipping-rates');

    expect(ctx.form.classList.contains('next-processing')).toBe(true);
    expect(ctx.loadingStates.get('shipping-rates')).toBe(true);
  });
});

describe('hideLoading', () => {
  it('keeps the form busy while another section is still running', () => {
    const ctx = createCtx();
    showLoading(ctx, 'checkout');
    showLoading(ctx, 'shipping-rates');

    hideLoading(ctx, 'checkout');

    expect(ctx.form.classList.contains('next-processing')).toBe(true);
  });

  it('clears the form once the last section finishes', () => {
    const ctx = createCtx();
    showLoading(ctx, 'checkout');
    showLoading(ctx, 'shipping-rates');

    hideLoading(ctx, 'checkout');
    hideLoading(ctx, 'shipping-rates');

    expect(ctx.form.classList.contains('next-processing')).toBe(false);
  });

  it('clears the section class even when other work continues', () => {
    const ctx = createCtx('<div data-section="checkout"></div>');
    showLoading(ctx, 'checkout');
    showLoading(ctx, 'other');

    hideLoading(ctx, 'checkout');

    expect(
      ctx.form
        .querySelector('[data-section="checkout"]')
        ?.classList.contains('next-loading')
    ).toBe(false);
  });

  /**
   * Known sharp edge, kept as found: `hideLoading` writes `false` for a section that was
   * never shown, and the "is anything still running" scan then sees no `true` values — so
   * a stray hide clears a busy state it did not set. `CheckoutFormEnhancer` does exactly
   * this on a payment error path (`this.ui.hideLoading('checkout')`), which is harmless
   * only because nothing else marks the form busy today.
   */
  it('clears the form when a section that never started is hidden', () => {
    const ctx = createCtx();
    ctx.form.classList.add('next-processing');

    hideLoading(ctx, 'never-started');

    expect(ctx.form.classList.contains('next-processing')).toBe(false);
  });
});

describe('updateProgress', () => {
  it('fills the bar to a quarter per step and reports it to assistive tech', () => {
    const ctx = createCtx(
      '<div class="next-progress-bar"><div class="next-progress-fill"></div></div>'
    );

    updateProgress(ctx, 2);

    const fill = ctx.form.querySelector<HTMLElement>('.next-progress-fill');
    expect(fill?.style.width).toBe('50%');
    expect(fill?.getAttribute('aria-valuenow')).toBe('50');
  });

  it('clamps past the ends of the bar', () => {
    const ctx = createCtx(
      '<div class="next-progress-bar"><div class="next-progress-fill"></div></div>'
    );

    updateProgress(ctx, 9);
    expect(
      ctx.form.querySelector<HTMLElement>('.next-progress-fill')?.style.width
    ).toBe('100%');

    updateProgress(ctx, -3);
    expect(
      ctx.form.querySelector<HTMLElement>('.next-progress-fill')?.style.width
    ).toBe('0%');
  });

  it('does nothing when the form has no progress bar', () => {
    const ctx = createCtx();

    expect(() => updateProgress(ctx, 1)).not.toThrow();
  });
});
