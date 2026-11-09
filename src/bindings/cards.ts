import { inputValues, stateClasses } from '../dom/dom';

/** A bundle card's id: its `data-next-bundle-id`, else its place among the selector's cards. */
export const bundleCardId = (el: Element, index: number): string =>
  el.getAttribute('data-next-bundle-id') || String(index);

/** `data-next-selected`, as a 0.4.x page sets it: exactly `"true"`. */
export const markedSelected = (el: Element): boolean => el.getAttribute('data-next-selected') === 'true';

export function setState(el: Element, on: boolean): void {
  stateClasses(el, on, on);
  el.setAttribute('data-next-selected', String(on));
  el.setAttribute('data-next-active', String(on));
  el.setAttribute('aria-pressed', String(on));
}

export const ownProperties = (el: Element): Record<string, string> =>
  inputValues(el.querySelectorAll('[data-next-property]'), (i) => i.getAttribute('data-next-property')!);

export function pageProperties(card?: Element): Record<string, string> {
  const exclude = (card?.getAttribute('data-next-exclude-property') ?? '').split(',').map((s) => s.trim());
  if (exclude.includes('*')) return {};
  const found = inputValues(document.querySelectorAll('[data-next-default-property]'), (el) =>
    el.getAttribute('data-next-default-property')!,
  );
  for (const name of exclude) delete found[name];
  return found;
}
