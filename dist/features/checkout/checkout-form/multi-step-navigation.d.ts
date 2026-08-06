import { CountryConfig } from '../../../core/country-service';
import { Logger } from '../../../core/logger';
import { LoadingOverlay } from '../../../core/ui/loading-overlay';
import { CheckoutState } from '../../../state/checkout';
import { CheckoutValidator } from '../validation/checkout-validator';
export interface MultiStepDetectionContext {
    form: HTMLFormElement;
    logger: Logger;
    setStep: (step: number) => void;
}
export interface MultiStepState {
    isMultiStep: boolean;
    currentStep: number;
    nextStepUrl: string;
}
export interface StepNavigationContext {
    currentStep: number;
    nextStepUrl: string | undefined;
    validator: Pick<CheckoutValidator, 'validateStep' | 'showError' | 'focusFirstErrorField'>;
    countryConfigs: Map<string, CountryConfig>;
    currentCountryConfig: {
        value: CountryConfig | undefined;
    };
    loadingOverlay: LoadingOverlay;
    getBillingValidationInput: () => {
        billingAddress: CheckoutState['billingAddress'];
        sameAsShipping: boolean;
    };
    logger: Logger;
}
export declare function detectMultiStepCheckout(ctx: MultiStepDetectionContext): MultiStepState | null;
export declare function handleStepNavigation(ctx: StepNavigationContext, checkoutStore: any): Promise<void>;
//# sourceMappingURL=multi-step-navigation.d.ts.map