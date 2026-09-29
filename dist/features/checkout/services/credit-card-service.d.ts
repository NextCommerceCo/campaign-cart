import { HostedCardField, CardHolderData } from './card-tokenizer';
import { CardInputConfig } from '../../../types/global';
export type CreditCardData = CardHolderData;
export interface CreditCardValidationState {
    number: {
        isValid: boolean;
        hasError: boolean;
        errorMessage?: string;
    };
    cvv: {
        isValid: boolean;
        hasError: boolean;
        errorMessage?: string;
    };
    month: {
        isValid: boolean;
        hasError: boolean;
        errorMessage?: string;
    };
    year: {
        isValid: boolean;
        hasError: boolean;
        errorMessage?: string;
    };
}
export declare class CreditCardService {
    private logger;
    private config?;
    private tokenizer;
    private isReady;
    private validationState;
    private onReadyCallback?;
    private onErrorCallback?;
    private onTokenCallback?;
    private numberField?;
    private cvvField?;
    private monthField?;
    private yearField?;
    private hasTrackedPaymentInfo;
    private onFieldFocusCallback?;
    private onFieldBlurCallback?;
    private onFieldInputCallback?;
    private fieldHasValue;
    private originalPlaceholders;
    private labelBehavior;
    private listenerAbort;
    constructor(environmentKey: string, config?: CardInputConfig);
    initialize(): Promise<void>;
    tokenizeCard(cardData: CreditCardData): Promise<string>;
    validateCreditCard(cardData: CreditCardData): {
        isValid: boolean;
        errors?: Record<string, string>;
    };
    checkSpreedlyFieldsReady(): {
        hasEmptyFields: boolean;
        errors: Array<{
            field: string;
            message: string;
        }>;
    };
    clearAllErrors(): void;
    clearFields(): void;
    private hidePaymentErrorContainers;
    setOnReady(callback: () => void): void;
    setOnError(callback: (errors: string[]) => void): void;
    setOnToken(callback: (token: string, pmData: any) => void): void;
    setFloatingLabelCallbacks(onFocus: (fieldName: 'number' | 'cvv') => void, onBlur: (fieldName: 'number' | 'cvv', hasValue: boolean) => void, onInput: (fieldName: 'number' | 'cvv', hasValue: boolean) => void): void;
    get ready(): boolean;
    focusField(field: HostedCardField): void;
    private initializeValidationState;
    private findCreditCardFields;
    private mountHostedFields;
    private handleTokenizeErrors;
    private setupFieldClickHandlers;
    private handleFieldState;
    private checkAndTrackPaymentInfo;
    private handleFieldFocus;
    private handleFieldBlur;
    private showTokenizeErrors;
    private setCreditCardFieldValid;
    private setCreditCardFieldError;
    private clearCreditCardFieldError;
    private getFieldElement;
    destroy(): void;
}
//# sourceMappingURL=credit-card-service.d.ts.map