import { CountryConfig, CountryService } from '../../../core/country-service';
export interface PostalCodeFormatContext {
    countryService: CountryService;
    countryConfigs: Map<string, CountryConfig>;
}
export declare function formatPostalCodeInPlace(ctx: PostalCodeFormatContext, target: HTMLInputElement, countryField: HTMLElement | undefined): void;
//# sourceMappingURL=postal-code-format.d.ts.map