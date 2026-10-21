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

  it('shows the receipt’s scroll hint only while the order list overflows and sits at the top', async () => {
    const doc = new DOMParser().parseFromString(
      readFileSync('tests/fixtures/pages/apollo/receipt.html', 'utf8'),
      'text/html',
    );
    document.body.innerHTML = doc.body.innerHTML;
    const layout = { scrollHeight: 0, clientHeight: 0, scrollTop: 0 };
    const lists = [...document.querySelectorAll<HTMLElement>('[data-next-order-items]')];
    for (const list of lists)
      for (const key of Object.keys(layout) as Array<keyof typeof layout>)
        Object.defineProperty(list, key, { get: () => layout[key] });
    const hints = [...document.querySelectorAll<HTMLElement>('[data-next-component="scroll-hint"]')];
    const shown = () => hints.map((h) => h.classList.contains('cart-items__scroll-hint--active'));
    const frame = async () => {
      await Promise.resolve();
      await new Promise(requestAnimationFrame);
    };
    expect(hints).toHaveLength(2);
    expect(shown()).toEqual([true, true]);

    bindWidgets();
    expect(shown()).toEqual([false, false]);
    expect(hints[0]!.getAttribute('aria-hidden')).toBe('true');

    Object.assign(layout, { scrollHeight: 600, clientHeight: 288 });
    lists[0]!.append(document.createElement('div'));
    await frame();
    expect(shown()).toEqual([true, false]);

    layout.scrollTop = 40;
    lists[0]!.dispatchEvent(new Event('scroll'));
    await frame();
    expect(shown()).toEqual([false, false]);
  });
});
