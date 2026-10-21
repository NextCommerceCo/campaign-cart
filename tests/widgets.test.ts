import { readFileSync } from 'node:fs';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { bindWidgets } from '../src/widgets';

afterEach(() => {
  vi.useRealTimers();
  document.body.innerHTML = '';
  document.head.innerHTML = '';
});

describe('page widgets', () => {
  it('opens and closes the receipt’s order summary the 0.4.x way', () => {
    const doc = new DOMParser().parseFromString(
      readFileSync('tests/fixtures/pages/apollo/receipt.html', 'utf8'),
      'text/html',
    );
    document.body.innerHTML = doc.body.innerHTML;
    bindWidgets();
    const container = document.querySelector<HTMLElement>('[data-next-accordion="order-summary"]')!;
    const trigger = container.querySelector<HTMLElement>('[data-next-accordion-trigger="order-summary"]')!;
    const text = container.querySelector('[data-next-accordion-text="order-summary"]')!;
    const panel = container.querySelector<HTMLElement>('[data-next-accordion-panel="order-summary"]')!;
    expect(panel.style.height).toBe('0px');
    expect(text.textContent).toBe('Show Order Summary');
    trigger.click();
    expect(container.classList).toContain('next-expanded');
    expect(text.textContent).toBe('Hide Order Summary');
    expect(trigger.getAttribute('aria-expanded')).toBe('true');
    trigger.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
    expect(container.classList).not.toContain('next-expanded');
  });

  it('shows a tooltip after a pause and hides it when the pointer leaves', () => {
    vi.useFakeTimers();
    document.body.innerHTML = `<span id="lock" data-next-tooltip="All transactions are secure and encrypted."></span>`;
    bindWidgets();
    const lock = document.getElementById('lock')!;
    lock.dispatchEvent(new Event('mouseenter'));
    expect(document.querySelector('.next-tooltip')).toBeNull();
    vi.advanceTimersByTime(500);
    const tip = document.querySelector('.next-tooltip--visible')!;
    expect(tip.getAttribute('role')).toBe('tooltip');
    expect(tip.textContent).toBe('All transactions are secure and encrypted.');
    lock.dispatchEvent(new Event('mouseleave'));
    vi.advanceTimersByTime(400);
    expect(document.querySelector('.next-tooltip')).toBeNull();
  });
});
