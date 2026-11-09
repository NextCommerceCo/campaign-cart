import type { Logger } from '../engine/runtime/log';
import { serviceTexts, type Texts } from '../engine/display/texts';
import type { Send } from '../engine/types';

/** One translation: `attribute` is `null` for the element's text. */
export interface I18nTarget {
  attribute: string | null;
  key: string;
}

const ATTRIBUTES = new Set(['placeholder', 'aria-label', 'title', 'alt']);
const ATTRIBUTE_TARGET = /^\[([^\]]*)\](.*)$/;

/** `checkout.pay;[title]checkout.pay.hint` → the text and the title; any other attribute is refused. */
export function parseI18n(value: string): { targets: I18nTarget[]; refused: string[] } {
  const targets: I18nTarget[] = [];
  const refused: string[] = [];
  for (const part of value.split(';').map((p) => p.trim())) {
    const match = ATTRIBUTE_TARGET.exec(part);
    const attribute = match ? match[1]!.trim().toLowerCase() : null;
    const key = (match ? match[2]! : part).trim();
    if (!key) continue;
    if (attribute === null || ATTRIBUTES.has(attribute)) targets.push({ attribute, key });
    else refused.push(attribute);
  }
  return { targets, refused };
}

function bindElement(el: Element, log: Logger): (translate: (key: string) => string | undefined) => void {
  const { targets, refused } = parseI18n(el.getAttribute('data-next-i18n') ?? '');
  for (const attribute of refused) {
    log.warn(
      `data-next-i18n cannot translate [${attribute}]; it translates the text, [placeholder], [aria-label], [title] and [alt]`,
    );
  }
  const textOnly = el.children.length === 0;
  if (!textOnly && targets.some((t) => t.attribute === null)) {
    log.warn(
      'data-next-i18n leaves the text of an element with child elements alone; put the text in an element of its own',
    );
  }
  const original = new Map(
    targets.map((t) => [t.attribute, t.attribute === null ? el.textContent : el.getAttribute(t.attribute)]),
  );
  return (translate) => {
    for (const { attribute, key } of targets) {
      const value = translate(key) ?? original.get(attribute) ?? null;
      if (attribute === null) {
        if (textOnly && value !== null) el.textContent = value;
      } else if (value === null) el.removeAttribute(attribute);
      else el.setAttribute(attribute, value);
    }
  };
}

/**
 * @deprecated 0.4.x `data-next-i18n`: a key's text in `lang`, from the page's `translations` (`page`), then
 * i18n-rules'; the page's own text when neither has it.
 */
export function bindI18n(
  root: ParentNode,
  { send, lang, page, log }: { send: Send; lang: string; page: Texts; log: Logger },
): Promise<void> {
  const paints = [...root.querySelectorAll('[data-next-i18n]')].map((el) => bindElement(el, log));
  const paint = (service?: Texts) => paints.forEach((p) => p((key) => page[key] ?? service?.[key]));
  paint();
  return serviceTexts(send, lang).then((texts) => texts && paint(texts));
}
