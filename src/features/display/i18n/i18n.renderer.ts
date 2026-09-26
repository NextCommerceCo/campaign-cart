import type { I18nTarget } from '@/utils/i18n-spec';

/** What an element held before it was translated, by target: `text` or the attribute. */
export type Originals = Map<string, string | null>;

const slotOf = (target: I18nTarget): string => target.attribute ?? 'text';

/**
 * Text is written only on an element that holds nothing but text: `textContent` would
 * erase an icon or a nested link, and the markup is the page's.
 */
export function canHoldText(element: Element): boolean {
  return element.children.length === 0;
}

/** Records what each target holds now, so a language with no translation gets it back. */
export function readOriginals(
  element: Element,
  targets: readonly I18nTarget[]
): Originals {
  const originals: Originals = new Map();
  for (const target of targets) {
    originals.set(
      slotOf(target),
      target.attribute === null
        ? element.textContent
        : element.getAttribute(target.attribute)
    );
  }
  return originals;
}

/**
 * Writes each target's translation, or what it held originally when there is none in the
 * language: a missing key leaves the page's own text, never another language's.
 */
export function applyTranslations(
  element: Element,
  targets: readonly I18nTarget[],
  originals: Originals,
  translate: (key: string) => string | undefined
): void {
  for (const target of targets) {
    const value =
      translate(target.key) ?? originals.get(slotOf(target)) ?? null;
    if (target.attribute === null) {
      if (canHoldText(element) && value !== null) element.textContent = value;
    } else if (value === null) {
      element.removeAttribute(target.attribute);
    } else {
      element.setAttribute(target.attribute, value);
    }
  }
}
