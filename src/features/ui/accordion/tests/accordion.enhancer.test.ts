import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { AccordionEnhancer } from '../accordion.enhancer';
import { EventBus } from '@/core/events';

/**
 * The accordion registers `click` and `keydown` on each of its triggers. Those
 * listeners are the whole feature, so the question these tests ask is the one
 * finding 165 in `docs/code-findings.md` says the destroy-contract gate was not
 * asking: after `destroy()`, does clicking a trigger still toggle the accordion?
 */

function buildAccordion(id = 'order-summary'): HTMLElement {
  const container = document.createElement('div');
  container.setAttribute('data-next-accordion', id);
  container.innerHTML = `
    <div data-next-accordion-trigger="${id}">
      <span data-next-accordion-text="${id}">Show</span>
    </div>
    <div data-next-accordion-panel="${id}"></div>
  `;
  document.body.appendChild(container);
  return container;
}

describe('AccordionEnhancer', () => {
  let container: HTMLElement;
  let trigger: HTMLElement;
  let enhancer: AccordionEnhancer;

  beforeEach(async () => {
    // openAccordion() nests its height animation in requestAnimationFrame; run it
    // synchronously so a toggle is fully observable in the same tick.
    vi.stubGlobal(
      'requestAnimationFrame',
      (cb: FrameRequestCallback): number => {
        cb(0);
        return 0;
      }
    );

    container = buildAccordion();
    const found = container.querySelector<HTMLElement>(
      '[data-next-accordion-trigger]'
    );
    if (!found) throw new Error('test fixture has no accordion trigger');
    trigger = found;
    enhancer = new AccordionEnhancer(container);
    await enhancer.initialize();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    document.body.innerHTML = '';
  });

  it('toggles the accordion open when a trigger is clicked', () => {
    expect(container.classList.contains('next-expanded')).toBe(false);

    trigger.click();

    expect(container.classList.contains('next-expanded')).toBe(true);
    expect(trigger.getAttribute('aria-expanded')).toBe('true');
  });

  it('toggles on Enter and Space, for keyboard users', () => {
    trigger.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Enter', bubbles: true })
    );
    expect(container.classList.contains('next-expanded')).toBe(true);

    trigger.dispatchEvent(
      new KeyboardEvent('keydown', { key: ' ', bubbles: true })
    );
    expect(container.classList.contains('next-expanded')).toBe(false);
  });

  it('stops toggling on click once destroyed', () => {
    enhancer.destroy();

    trigger.click();

    expect(container.classList.contains('next-expanded')).toBe(false);
    expect(trigger.getAttribute('aria-expanded')).toBe('false');
  });

  it('stops toggling on keydown once destroyed', () => {
    enhancer.destroy();

    trigger.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Enter', bubbles: true })
    );

    expect(container.classList.contains('next-expanded')).toBe(false);
  });

  it('emits no accordion event once destroyed', () => {
    const seen: string[] = [];
    const bus = EventBus.getInstance();
    const offToggled = bus.on('accordion:toggled', () => seen.push('toggled'));
    const offOpened = bus.on('accordion:opened', () => seen.push('opened'));

    enhancer.destroy();
    trigger.click();

    offToggled();
    offOpened();
    expect(seen).toEqual([]);
  });
});
