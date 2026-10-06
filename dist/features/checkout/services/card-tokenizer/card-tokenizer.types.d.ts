import { CardTextKey } from './card-texts';
export type HostedCardField = 'number' | 'cvv';
export type CardErrorField = HostedCardField | 'month' | 'year' | 'full_name';
export interface HostedFieldState {
    field: HostedCardField;
    action: 'focus' | 'blur' | 'input' | 'validation';
    hasValue?: boolean;
    valid?: boolean;
}
export interface CardError {
    field?: CardErrorField;
    textKey: CardTextKey;
    message: string;
}
export type CardPaymentMethod = Record<string, unknown>;
export interface CardHolderData {
    full_name: string;
    first_name?: string;
    last_name?: string;
    month: string;
    year: string;
}
export interface CardTokenizerEvents {
    onReady: () => void;
    onFieldState: (state: HostedFieldState) => void;
    onError: (errors: CardError[]) => void;
    onToken: (token: string, paymentMethod: CardPaymentMethod) => void;
}
export interface HostedFieldsMount {
    numberId: string;
    cvvId: string;
    labels: Record<HostedCardField, string>;
    placeholders: Record<HostedCardField, string>;
    titles: Record<HostedCardField, string>;
}
//# sourceMappingURL=card-tokenizer.types.d.ts.map