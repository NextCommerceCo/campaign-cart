import type { Logger } from '../engine/log';
import type { Send } from '../engine/types';

type Texts = Readonly<Record<string, string>>;

/** One translation: `attribute` is `null` for the element's text. */
export interface I18nTarget {
  attribute: string | null;
  key: string;
}

interface LegacyI18nConfig {
  locale?: unknown;
  translations?: unknown;
}

const RULES = 'https://i18n-rules.nextcommerce.com';
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

/** `{ fields: { email: { label: 'Email' } } }` → `{ 'fields.email.label': 'Email' }`. */
export function flattenTexts(value: unknown, prefix = ''): Record<string, string> {
  const texts: Record<string, string> = {};
  if (!value || typeof value !== 'object' || Array.isArray(value)) return texts;
  for (const [key, entry] of Object.entries(value)) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (typeof entry === 'string') texts[path] = entry;
    else Object.assign(texts, flattenTexts(entry, path));
  }
  return texts;
}

/** `th-TH` → `th`. */
export const baseLang = (lang: string) => lang.toLowerCase().split(/[-_]/)[0]!;

/** `translations[lang]`: `th-TH`, else `th`. */
export function pageTexts(translations: unknown, lang: string): Texts {
  if (!translations || typeof translations !== 'object') return {};
  const byLang = Object.fromEntries(Object.entries(translations).map(([l, t]) => [l.toLowerCase(), t]));
  return flattenTexts(byLang[lang.toLowerCase()] ?? byLang[baseLang(lang)]);
}

/** i18n-rules' texts in `lang`; `undefined` when it cannot answer, or answers in another language. */
export async function serviceTexts(send: Send, lang: string, base = RULES): Promise<Texts | undefined> {
  try {
    const res = await send(`${base}/v1/locales/${encodeURIComponent(lang)}`, { method: 'GET' });
    if (!res.ok || baseLang(res.headers.get('content-language') ?? lang) !== baseLang(lang)) return undefined;
    return flattenTexts(await res.json());
  } catch {
    return undefined;
  }
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
 * @deprecated 0.4.x `data-next-i18n`, `nextConfig.locale` and `nextConfig.translations`: a key's text in the page's
 * language, from the page's translations, then i18n-rules'; the page's own text when neither has it.
 */
export function bindI18n(
  root: ParentNode,
  { send, language, log }: { send: Send; language?: string; log: Logger },
): Promise<void> {
  const config = (window as unknown as { nextConfig?: LegacyI18nConfig }).nextConfig ?? {};
  const lang = (typeof config.locale === 'string' && config.locale.trim()) || language || 'en';
  const page = pageTexts(config.translations, lang);
  const paints = [...root.querySelectorAll('[data-next-i18n]')].map((el) => bindElement(el, log));
  const paint = (service?: Texts) => paints.forEach((p) => p((key) => page[key] ?? service?.[key]));
  paint();
  return serviceTexts(send, lang).then((texts) => texts && paint(texts));
}
