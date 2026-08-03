import { describe, it, expect, vi } from 'vitest';

import { attachPropertyListeners } from '../properties';

/**
 * `attachPropertyListeners` binds `input` and `blur` to author-supplied
 * `[data-next-property]` fields inside a card the enhancer does not own, and writes
 * into a properties object the enhancer does. Both listeners used to be unremovable,
 * so they survived the enhancer and re-enhancing the same card stacked another set
 * (finding 169 in `docs/code-findings.md`).
 *
 * The signal the caller passes is the whole contract: when the enhancer aborts it, the
 * card stops writing into an object nothing reads any more.
 */

function mountCard(): {
  card: HTMLElement;
  field: HTMLInputElement;
} {
  const card = document.createElement('div');
  card.innerHTML = '<input data-next-property="team">';
  document.body.appendChild(card);
  return {
    card,
    field: card.querySelector('input') as HTMLInputElement,
  };
}

describe('attachPropertyListeners', () => {
  it('writes the field value into the properties object while it is live', () => {
    const { card, field } = mountCard();
    const properties: Record<string, string> = {};
    const controller = new AbortController();

    attachPropertyListeners(card, properties, controller.signal);

    field.value = 'Rockets';
    field.dispatchEvent(new Event('input'));

    expect(properties.team).toBe('Rockets');
  });

  it('stops writing once the caller aborts the signal', () => {
    const { card, field } = mountCard();
    const properties: Record<string, string> = {};
    const controller = new AbortController();

    attachPropertyListeners(card, properties, controller.signal);
    controller.abort();

    field.value = 'Rockets';
    field.dispatchEvent(new Event('input'));

    expect(properties.team).toBeUndefined();
  });

  it('stops calling onBlur once the caller aborts the signal', () => {
    const { card, field } = mountCard();
    const onBlur = vi.fn();
    const controller = new AbortController();

    attachPropertyListeners(card, {}, controller.signal, onBlur);
    field.dispatchEvent(new Event('blur'));
    expect(onBlur).toHaveBeenCalledTimes(1);

    controller.abort();
    field.dispatchEvent(new Event('blur'));
    expect(onBlur).toHaveBeenCalledTimes(1);
  });
});
