declare const TRANSLATABLE_ATTRIBUTES: readonly ["placeholder", "aria-label", "title", "alt"];
export type TranslatableAttribute = (typeof TRANSLATABLE_ATTRIBUTES)[number];
export interface I18nTarget {
    attribute: TranslatableAttribute | null;
    key: string;
}
export declare function parseI18n(value: string): {
    targets: I18nTarget[];
    refused: string[];
};
export {};
//# sourceMappingURL=i18n-spec.d.ts.map