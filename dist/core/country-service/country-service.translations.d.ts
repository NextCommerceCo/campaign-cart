type Texts = Readonly<Record<string, string>>;
export interface MessageSource {
    getFieldErrors?: (country?: string) => Readonly<Record<string, Texts>>;
    getMessagesLang?: () => string | undefined;
}
export declare function baseLang(lang: string): string;
export declare function pageTranslations(lang: string): Texts;
export declare function sourceIn(source: MessageSource | undefined, lang: string): MessageSource | undefined;
export declare function translatedText(key: string, lang: string, serviceTexts?: Texts): string | undefined;
export {};
//# sourceMappingURL=country-service.translations.d.ts.map