import { CountryRules, FixedValues, PostcodeResult } from './i18n-rules.api';
import { PhoneNumberResult, PhoneRules } from './i18n-rules.phone';
import { AddressConfig } from '../../types/global';
export interface CountryConfig {
    stateLabel: string;
    stateRequired: boolean;
    postcodeLabel: string;
    postcodeRegex: string | null;
    postcodeMinLength: number;
    postcodeMaxLength: number;
    postcodeExample: string | null;
    postcodeFormat: string | string[] | null;
    postcodeCompact?: boolean;
    postcodeRequired?: boolean;
    fixed?: FixedValues;
    phone?: PhoneRules;
    currencyCode: string;
    currencySymbol: string;
}
export interface Country {
    code: string;
    name: string;
    phonecode: string;
    currencyCode: string;
    currencySymbol: string;
}
export interface State {
    code: string;
    name: string;
}
export interface LocationData {
    detectedCountryCode: string;
    detectedCountryConfig: CountryConfig;
    detectedStates: State[];
    countries: Country[];
    detectedIp?: string;
    messages?: Record<string, string>;
    fieldErrors?: Record<string, Readonly<Record<string, string>>>;
    fieldLabelIds?: Record<string, string>;
    messagesLang?: string;
}
export interface CountryStatesData {
    countryConfig: CountryConfig;
    states: State[];
    rules?: CountryRules;
    messages?: Record<string, string>;
    fieldErrors?: Record<string, Readonly<Record<string, string>>>;
    fieldLabelIds?: Record<string, string>;
    messagesLang?: string;
}
export declare function addressLang(pageLang?: string): string;
export declare class I18nRules {
    private static instance;
    private cachePrefix;
    private cacheExpiry;
    private messagesLang;
    private texts;
    private textRequests;
    private phoneNumbers;
    private postcodes;
    private fieldErrors;
    private lastFieldErrors;
    private fieldLabelIds;
    private lastFieldLabelIds;
    private logger;
    private config;
    private campaignShippingCountries;
    private constructor();
    static getInstance(): I18nRules;
    setConfig(config: AddressConfig): void;
    getConfig(): AddressConfig;
    setCampaignShippingCountries(countries: Array<{
        code: string;
        label: string;
    }> | null): void;
    getCampaignShippingCountries(): string[] | null;
    getMessagesLang(): string | undefined;
    getTexts(lang: string): Readonly<Record<string, string>> | undefined;
    readPhoneNumber(number: string, country: string): Promise<PhoneNumberResult | undefined>;
    readPostcode(postcode: string, country: string, state?: string): Promise<PostcodeResult | undefined>;
    loadTexts(lang: string): Promise<void>;
    getFieldErrors(country?: string): Readonly<Record<string, Readonly<Record<string, string>>>>;
    getFieldLabelIds(country?: string): Readonly<Record<string, string>>;
    private keepMessages;
    getLocationData(): Promise<LocationData>;
    getCountryStates(countryCode: string): Promise<CountryStatesData>;
    getCountryConfig(countryCode: string): Promise<CountryConfig>;
    validatePostalCode(postalCode: string, _countryCode: string, countryConfig: CountryConfig): boolean;
    formatPostalCode(postalCode: string, countryConfig: CountryConfig): string;
    clearCache(): void;
    clearCountryCache(countryCode: string): void;
    private getFromCache;
    private setCache;
    private getDefaultCountryConfig;
    private getFallbackLocationData;
    private applyCountryFiltering;
    private applyStateFiltering;
}
//# sourceMappingURL=i18n-rules.d.ts.map