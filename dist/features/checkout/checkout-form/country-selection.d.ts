import { Country, I18nRules } from '../../../core/i18n-rules';
import { Logger } from '../../../core/logger';
import { ShippingStateFieldsContext, StateFieldsContext } from './state-fields';
export interface CountryResolutionContext {
    countries: Country[];
    i18nRules: I18nRules;
    logger: Logger;
}
export interface CountryApplicationContext {
    logger: Logger;
    fields: Map<string, HTMLElement>;
    billingFields: Map<string, HTMLElement>;
    updateFormData: (data: Record<string, unknown>) => void;
    shippingStateFields: ShippingStateFieldsContext;
    stateFields: StateFieldsContext;
}
export declare function resolveShippingCountry(ctx: CountryResolutionContext, detectedCountryCode: string, storedCountry: string | undefined): string;
export declare function applyCountryToAddressForms(ctx: CountryApplicationContext, newCountry: string): Promise<void>;
//# sourceMappingURL=country-selection.d.ts.map