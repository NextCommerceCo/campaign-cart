import { I18nRules, FixedValues } from '../../../core/i18n-rules';
import { Logger } from '../../../core/logger';
export declare function fixedValuesPatch(address: Readonly<Record<string, unknown>> | undefined, from: FixedValues | undefined, to: FixedValues | undefined): Record<string, string>;
export interface FixedValuesContext {
    i18nRules: I18nRules;
    logger: Logger;
    updateFormData: (data: Record<string, string>) => void;
}
export interface AppliedFixedValues {
    country?: string;
    values?: FixedValues;
}
export declare function applyFixedValues(ctx: FixedValuesContext, form: 'shipping' | 'billing', country: string | undefined, applied: AppliedFixedValues): Promise<void>;
//# sourceMappingURL=fixed-address-values.d.ts.map