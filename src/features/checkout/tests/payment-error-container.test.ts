import { describe, it, expect, vi, beforeEach } from 'vitest';

import type { Logger } from '@/core/logger';

import {
  hideAllPaymentErrors,
  resolvePaymentErrorTarget,
  showPaymentErrorTarget,
} from '../utils/payment-error-container';

function createMockLogger() {
  return { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() };
}

const logger = (): Logger => createMockLogger() as unknown as Logger;

/**
 * One payment method as a real page writes it: the wrapper, the form that opens
 * and shuts, and — optionally — the method's own error slot inside that form.
 */
function addMethod(
  markup: string,
  opts: { state?: 'expanded' | 'collapsed'; error?: string | null } = {}
): void {
  const wrapper = document.createElement('div');
  wrapper.setAttribute('data-next-payment-method', markup);

  const form = document.createElement('div');
  form.setAttribute('data-next-payment-form', '');
  form.setAttribute('data-next-payment-state', opts.state ?? 'collapsed');

  if (opts.error) {
    form.innerHTML = `
      <div data-next-component="${opts.error}">
        <div data-next-component="${opts.error}-text"></div>
      </div>`;
  }

  wrapper.appendChild(form);
  document.body.appendChild(wrapper);
}

beforeEach(() => {
  document.body.innerHTML = '';
});

/**
 * Where a payment failure is written. Three writers ask this — the checkout form,
 * the card tokenizer and the express processor — and before this they answered it
 * with a `credit-error` lookup each, which is why a shopper refused by iDEAL saw
 * nothing at all: the message went into the card's container, which the card's own
 * collapsed form had sealed shut.
 */
describe('resolvePaymentErrorTarget', () => {
  it('writes into the chosen method’s own container', () => {
    addMethod('credit', { state: 'collapsed', error: 'credit-error' });
    addMethod('ideal', { state: 'expanded', error: 'ideal-error' });

    const target = resolvePaymentErrorTarget('ideal', logger());

    expect(target?.container.getAttribute('data-next-component')).toBe(
      'ideal-error'
    );
    expect(target?.text.getAttribute('data-next-component')).toBe(
      'ideal-error-text'
    );
  });

  it.each([
    ['apple_pay', 'apple-pay'],
    ['apple_pay', 'apple_pay'],
    ['sepa_debit', 'sepa_debit'],
    ['google_pay', 'google-pay'],
  ])('finds %s under the page’s spelling of it, %s', (method, markup) => {
    addMethod(markup, { state: 'expanded', error: `${markup}-error` });

    const target = resolvePaymentErrorTarget(method, logger());

    expect(target?.container.getAttribute('data-next-component')).toBe(
      `${markup}-error`
    );
  });

  it('finds the card’s container under the page’s word for a card', () => {
    addMethod('credit', { state: 'expanded', error: 'credit-error' });

    const target = resolvePaymentErrorTarget('credit-card', logger());

    expect(target?.container.getAttribute('data-next-component')).toBe(
      'credit-error'
    );
  });

  it('falls back to credit-error for a method with no container of its own', () => {
    addMethod('credit', { state: 'expanded', error: 'credit-error' });
    addMethod('ideal', { state: 'collapsed' });

    const target = resolvePaymentErrorTarget('ideal', logger());

    expect(target?.container.getAttribute('data-next-component')).toBe(
      'credit-error'
    );
  });

  /**
   * The shipped-page case, and the whole point of this module. `credit-error`
   * lives inside the card's `data-next-payment-form`, and that form is shut
   * whenever a card is not the chosen method — so the message was written, styled
   * and revealed inside a box of `height: 0; overflow: hidden`.
   */
  it('lifts the fallback out of a collapsed form so it can be read', () => {
    addMethod('credit', { state: 'collapsed', error: 'credit-error' });
    addMethod('ideal', { state: 'collapsed' });

    const target = resolvePaymentErrorTarget('ideal', logger());

    expect(target).not.toBeNull();
    expect(target?.container.closest('[data-next-payment-form]')).toBeNull();
    expect(
      target?.container
        .closest('[data-next-payment-method]')
        ?.getAttribute('data-next-payment-method')
    ).toBe('credit');
  });

  it('leaves the fallback where it is when its form is open', () => {
    addMethod('credit', { state: 'expanded', error: 'credit-error' });

    const target = resolvePaymentErrorTarget('credit-card', logger());

    expect(
      target?.container.closest('[data-next-payment-form]')
    ).not.toBeNull();
  });

  it('writes into the container itself when the page wrote no text element', () => {
    const bare = document.createElement('div');
    bare.setAttribute('data-next-component', 'credit-error');
    document.body.appendChild(bare);

    const target = resolvePaymentErrorTarget('credit-card', logger());

    expect(target?.text).toBe(target?.container);
  });

  it('reports a page with no payment error container at all', () => {
    addMethod('ideal', { state: 'expanded' });

    expect(resolvePaymentErrorTarget('ideal', logger())).toBeNull();
  });

  it('still finds the shared container when no method is known', () => {
    addMethod('credit', { state: 'expanded', error: 'credit-error' });

    expect(
      resolvePaymentErrorTarget(undefined, logger())?.container.getAttribute(
        'data-next-component'
      )
    ).toBe('credit-error');
  });
});

describe('showPaymentErrorTarget', () => {
  it('overrides all four ways a page can hide the container', () => {
    const container = document.createElement('div');
    container.classList.add('hidden');
    container.style.display = 'none';
    container.style.visibility = 'hidden';
    container.style.opacity = '0';
    document.body.appendChild(container);

    showPaymentErrorTarget({ container, text: container });

    expect(container.style.display).toBe('flex');
    expect(container.style.visibility).toBe('visible');
    expect(container.style.opacity).toBe('1');
    expect(container.classList.contains('visible')).toBe(true);
    expect(container.classList.contains('hidden')).toBe(false);
  });
});

describe('hideAllPaymentErrors', () => {
  it('hides every method’s container, not only the card’s', () => {
    addMethod('credit', { state: 'expanded', error: 'credit-error' });
    addMethod('ideal', { state: 'collapsed', error: 'ideal-error' });
    addMethod('paypal', { state: 'collapsed', error: 'paypal-error' });

    const containers = [
      ...document.querySelectorAll<HTMLElement>(
        '[data-next-component$="-error"]'
      ),
    ];
    containers.forEach(c => showPaymentErrorTarget({ container: c, text: c }));

    hideAllPaymentErrors();

    expect(containers).toHaveLength(3);
    for (const container of containers) {
      expect(container.style.display).toBe('none');
      expect(container.classList.contains('visible')).toBe(false);
    }
  });
});
