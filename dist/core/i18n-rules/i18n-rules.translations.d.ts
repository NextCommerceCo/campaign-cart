type Texts = Readonly<Record<string, string>>;
export interface TextSource {
    getTexts: (lang: string) => Texts | undefined;
    loadTexts: (lang: string) => Promise<void>;
}
export interface MessageSource {
    getFieldErrors?: (country?: string) => Readonly<Record<string, Texts>>;
    getFieldLabelIds?: (country?: string) => Texts;
    getMessagesLang?: () => string | undefined;
}
export declare function baseLang(lang: string): string;
export declare function pageTranslations(lang: string): Texts;
export declare function sourceIn(source: MessageSource | undefined, lang: string): MessageSource | undefined;
export declare function translatedText(key: string, lang: string, serviceTexts?: Texts): string | undefined;
export declare function textsWithin(source: TextSource, lang: string, waitMs: number): Promise<Texts | undefined>;
export declare function interpolate(template: string, vars: Readonly<Record<string, string>>): string;
export {};
//# sourceMappingURL=i18n-rules.translations.d.ts.map