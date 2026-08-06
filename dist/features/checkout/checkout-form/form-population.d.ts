import { Logger } from '../../../core/logger';
import { Iti } from 'intl-tel-input';
import { ShippingStateFieldsContext } from './state-fields';
export interface FormPopulationContext {
    fields: Map<string, HTMLElement>;
    detectedCountryCode: string;
    logger: Logger;
    phoneInputs: Map<string, Iti>;
    shippingStateFields: ShippingStateFieldsContext;
    updateFormData: (data: Record<string, unknown>) => void;
    updateLabelsForPopulatedData: () => void;
}
export interface FormClearingContext {
    form: HTMLFormElement;
    fields: Map<string, HTMLElement>;
    billingFields: Map<string, HTMLElement>;
    detectedCountryCode: string;
    logger: Logger;
    clearCardFields?: (() => void) | undefined;
}
export declare function populateFormData(ctx: FormPopulationContext): Promise<void>;
export declare function clearAllCheckoutFields(ctx: FormClearingContext): void;
//# sourceMappingURL=form-population.d.ts.map