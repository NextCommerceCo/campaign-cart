import { Logger } from '../logger';
import { CountryConfig } from '.';
export declare function asksForPostcode(config: CountryConfig | undefined): boolean;
export declare function validatePostalCode(logger: Logger, postalCode: string, _countryCode: string, countryConfig: CountryConfig): boolean;
export declare function formatPostalCode(postalCode: string, countryConfig: CountryConfig): string;
export declare function getDefaultCountryConfig(countryCode: string): CountryConfig;
//# sourceMappingURL=i18n-rules.postal-code.d.ts.map