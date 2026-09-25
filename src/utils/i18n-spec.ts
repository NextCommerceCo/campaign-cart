/**
 * `data-next-i18n`, read: i18next's syntax, `key` for the text and `[attribute]key` for an
 * attribute, several separated by `;` — `checkout.submit;[title]checkout.submit.hint`.
 */

/**
 * The attributes a translation may write. Not every attribute, as i18next allows: a
 * translation string reaching `[href]` or `[onclick]` would be markup on a checkout page.
 */
const TRANSLATABLE_ATTRIBUTES = [
  'placeholder',
  'aria-label',
  'title',
  'alt',
] as const;
export type TranslatableAttribute = (typeof TRANSLATABLE_ATTRIBUTES)[number];

/** One translation: `attribute` is `null` for the element's text. */
export interface I18nTarget {
  attribute: TranslatableAttribute | null;
  key: string;
}

const ATTRIBUTE_TARGET = /^\[([^\]]*)\](.*)$/;

function isTranslatable(name: string): name is TranslatableAttribute {
  return (TRANSLATABLE_ATTRIBUTES as readonly string[]).includes(name);
}

/** The targets `value` names, and the attributes it names that may not be translated. */
export function parseI18n(value: string): {
  targets: I18nTarget[];
  refused: string[];
} {
  const targets: I18nTarget[] = [];
  const refused: string[] = [];
  for (const part of value.split(';').map(entry => entry.trim())) {
    const match = ATTRIBUTE_TARGET.exec(part);
    const attribute = match ? (match[1] ?? '').trim().toLowerCase() : null;
    const key = (match ? (match[2] ?? '') : part).trim();
    if (!key) continue;
    if (attribute === null) targets.push({ attribute: null, key });
    else if (isTranslatable(attribute)) targets.push({ attribute, key });
    else refused.push(attribute);
  }
  return { targets, refused };
}

/** Whether `element`'s `data-next-i18n` translates `attribute`. */
export function translatesAttribute(
  element: Element,
  attribute: TranslatableAttribute
): boolean {
  const value = element.getAttribute('data-next-i18n');
  return value !== null
    ? parseI18n(value).targets.some(target => target.attribute === attribute)
    : false;
}
