import { CountryConfig, I18nRules } from '../../../core/i18n-rules';
export interface PostalCodeFormatContext {
    i18nRules: I18nRules;
    countryConfigs: Map<string, CountryConfig>;
}
export declare function formatPostalCodeInPlace(ctx: PostalCodeFormatContext, target: HTMLInputElement, countryField: HTMLElement | undefined): void;
//# sourceMappingURL=postal-code-format.d.ts.map