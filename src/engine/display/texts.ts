import type { Send } from '../types';

declare const __VERSION__: string;

/** Texts by dotted key, as i18n-rules' `/v1/locales/:lang` and the page's `translations` give them. */
export type Texts = Readonly<Record<string, string>>;

export const I18N_RULES = 'https://i18n-rules.nextcommerce.com';

/** `send` naming the SDK version and the campaign's key, for i18n-rules' analytics. */
export const rulesSend =
  (send: Send, campaignKey?: string): Send =>
  (url, init) =>
    send(url, {
      ...init,
      headers: {
        'X-Next-SDK-Version': __VERSION__,
        ...(campaignKey && { 'X-Next-Campaign-Key': campaignKey }),
        ...init.headers,
      },
    });

/** `th-TH` → `th`. */
export const baseLang = (lang: string) => lang.toLowerCase().split(/[-_]/)[0]!;

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

/** `translations` (keyed by lower-case language) in `lang`: `th-TH`, else `th`. */
export const textsIn = (translations: Readonly<Record<string, Texts>>, lang: string): Texts =>
  translations[lang.toLowerCase()] ?? translations[baseLang(lang)] ?? {};

/** `'Coupon {{code}} applied.'` with `{ code: 'SAVE10' }` → `'Coupon SAVE10 applied.'` */
export const fill = (text: string, vars: Readonly<Record<string, string | number | undefined>>) =>
  text.replace(/\{\{\s*(\w+)\s*\}\}/g, (match, key: string) => String(vars[key] ?? match));

const asked = new Map<string, Promise<Texts | undefined>>();
const answered = new Map<string, Texts>();

/** i18n-rules' texts in `lang`, once per language; `undefined` when it cannot answer or answers in another language. */
export function serviceTexts(send: Send, lang: string, base = I18N_RULES): Promise<Texts | undefined> {
  const key = baseLang(lang);
  let answer = asked.get(key);
  if (!answer) {
    answer = send(`${base}/v1/locales/${encodeURIComponent(lang)}`, { method: 'GET' })
      .then(async (res) =>
        res.ok && baseLang(res.headers.get('content-language') ?? lang) === key
          ? flattenTexts(await res.json())
          : undefined,
      )
      .catch(() => undefined)
      .then((texts) => {
        if (texts) answered.set(key, texts);
        else asked.delete(key);
        return texts;
      });
    asked.set(key, answer);
  }
  return answer;
}

/** i18n-rules' texts in `lang` if something on the page has loaded them. */
export const loadedTexts = (lang: string): Texts | undefined => answered.get(baseLang(lang));
