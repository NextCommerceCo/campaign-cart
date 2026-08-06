import { Logger } from '../logger';
import { CountryConfig } from '.';
export declare function validatePostalCode(logger: Logger, postalCode: string, _countryCode: string, countryConfig: CountryConfig): boolean;
export declare function formatPostalCode(postalCode: string, countryConfig: CountryConfig): string;
export declare function getDefaultCountryConfig(countryCode: string): CountryConfig;
//# sourceMappingURL=country-service.postal-code.d.ts.map