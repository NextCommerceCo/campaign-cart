import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { setupEnterKeyNavigation } from '../enter-key-navigation';

let stop: () => void;

/** happy-dom lays nothing out, so every field reads as rendered unless it is `hidden`. */
beforeEach(() => {
  vi.spyOn(Element.prototype, 'getClientRects').mockImplementation(function (
    this: Element
  ) {
    return (this.closest('[hidden]') ? [] : [{}]) as unknown as DOMRectList;
  });
  document.body.innerHTML = `
    <form data-next-checkout>
      <input data-next-checkout-field="fname">
      <div hidden><input data-next-checkout-field="city"></div>
      <input data-next-checkout-field="lname" enterkeyhint="go">
      <button type="submit">Pay</button>
    </form>`;
  stop = setupEnterKeyNavigation(document.querySelector('form')!);
});

afterEach(() => {
  stop();
  vi.restoreAllMocks();
});

const field = (name: string) =>
  document.querySelector<HTMLInputElement>(
    `[data-next-checkout-field="${name}"]`
  )!;

function pressEnter(
  target: HTMLElement,
  init: KeyboardEventInit = {}
): KeyboardEvent {
  const event = new KeyboardEvent('keydown', {
    key: 'Enter',
    bubbles: true,
    cancelable: true,
    ...init,
  });
  target.dispatchEvent(event);
  return event;
}

describe('setupEnterKeyNavigation', () => {
  it('moves past a field that is not shown', () => {
    const event = pressEnter(field('fname'));
    expect(event.defaultPrevented).toBe(true);
    expect(document.activeElement).toBe(field('lname'));
  });

  it('leaves Enter alone while an IME is composing a word', () => {
    field('fname').focus();
    const event = pressEnter(field('fname'), { isComposing: true });
    expect(event.defaultPrevented).toBe(false);
    expect(document.activeElement).toBe(field('fname'));
  });

  it('leaves an Enter something else already handled, like a suggestion list', () => {
    field('fname').addEventListener('keydown', e => e.preventDefault());
    field('fname').focus();
    pressEnter(field('fname'));
    expect(document.activeElement).toBe(field('fname'));
  });

  it('keeps an enterkeyhint the page wrote, and writes its own elsewhere', () => {
    field('lname').dispatchEvent(new FocusEvent('focusin', { bubbles: true }));
    field('fname').dispatchEvent(new FocusEvent('focusin', { bubbles: true }));
    expect(field('lname').getAttribute('enterkeyhint')).toBe('go');
    expect(field('fname').getAttribute('enterkeyhint')).toBe('next');
  });

  it('stops when told to', () => {
    stop();
    const event = pressEnter(field('fname'));
    expect(event.defaultPrevented).toBe(false);
  });
});
