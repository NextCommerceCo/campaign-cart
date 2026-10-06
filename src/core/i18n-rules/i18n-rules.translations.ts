/**
 * Where a translated text comes from: the page's `nextConfig.translations` for the
 * language, then the address-rules service's texts when they are in that language.
 * Nothing falls back to another language here: a caller with no text in the language
 * keeps its own, which is what stops a page reading in two.
 */

import { useConfigStore } from '@/state/config';

type Texts = Readonly<Record<string, string>>;

/** What waiting for the service's texts needs from `I18nRules`. */
export interface TextSource {
  getTexts: (lang: string) => Texts | undefined;
  loadTexts: (lang: string) => Promise<void>;
}

/** What a lookup needs from `I18nRules`. */
export interface MessageSource {
  getFieldErrors?: (country?: string) => Readonly<Record<string, Texts>>;
  getFieldLabelIds?: (country?: string) => Texts;
  getMessagesLang?: () => string | undefined;
}

/** `th-TH` → `th`. */
export function baseLang(lang: string): string {
  return lang.toLowerCase().split(/[-_]/)[0] ?? lang;
}

/** The page's own texts for `lang`: `th-TH`, else `th`. */
export function pageTranslations(lang: string): Texts {
  const translations = useConfigStore.getState().translations;
  const code = lang.toLowerCase();
  return translations?.[code] ?? translations?.[baseLang(code)] ?? {};
}

/**
 * `source` when its messages are in `lang`, else `undefined`. An answer from before the
 * service named its language was in the one asked for.
 */
export function sourceIn(
  source: MessageSource | undefined,
  lang: string
): MessageSource | undefined {
  const answered = source?.getMessagesLang?.();
  return answered === undefined || answered === baseLang(lang)
    ? source
    : undefined;
}

/**
 * `key` in `lang`: the page's translation, then `serviceTexts`, the service's texts in
 * that same language. `undefined` when neither has it, for the caller to keep its own.
 */
export function translatedText(
  key: string,
  lang: string,
  serviceTexts?: Texts
): string | undefined {
  return pageTranslations(lang)[key] ?? serviceTexts?.[key];
}

/**
 * The service's texts in `lang`, loading them if no element on the page has, but waiting
 * no longer than `waitMs`: the shopper is waiting on the sentence, and past that the
 * caller shows its own.
 */
export async function textsWithin(
  source: TextSource,
  lang: string,
  waitMs: number
): Promise<Texts | undefined> {
  const loaded = source.getTexts(lang);
  if (loaded) return loaded;
  let timer: ReturnType<typeof setTimeout> | undefined;
  await Promise.race([
    source.loadTexts(lang),
    new Promise<void>(resolve => {
      timer = setTimeout(resolve, waitMs);
    }),
  ]);
  clearTimeout(timer);
  return source.getTexts(lang);
}

/** `'Coupon {{code}} applied.'` with `{ code: 'SAVE10' }` → `'Coupon SAVE10 applied.'` */
export function interpolate(
  template: string,
  vars: Readonly<Record<string, string>>
): string {
  return template.replace(
    /\{\{\s*(\w+)\s*\}\}/g,
    (match, key: string) => vars[key] ?? match
  );
}
