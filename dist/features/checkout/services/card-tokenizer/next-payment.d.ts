import { CardInputConfig } from '../../../../types/global';
import { CardError, CardHolderData, CardTokenizerEvents, HostedCardField, HostedFieldsMount } from './card-tokenizer.types';
interface NextPaymentFieldError {
    attribute?: string;
    key?: string;
    message?: string;
}
interface NextPaymentFieldState {
    field?: unknown;
    action?: unknown;
    numberLength?: unknown;
    cvvLength?: unknown;
    validNumber?: unknown;
    validCvv?: unknown;
}
interface NextPaymentOptions {
    numberEl: string;
    cvvEl: string;
    numberFormat?: string;
    labels?: Record<HostedCardField, string>;
    placeholder?: Record<HostedCardField, string>;
    titles?: Record<HostedCardField, string>;
    styling?: Partial<Record<HostedCardField | 'placeholder', Record<string, string>>>;
}
interface NextPaymentInstance {
    onReady: () => void;
    onValidation: (payload: {
        errors?: NextPaymentFieldError[];
    }) => void;
    onError: (error: unknown) => void;
    onTokenized: (result: unknown) => void;
    onFieldStateChange: (payload: NextPaymentFieldState | undefined) => void;
    setFocus(field: HostedCardField): void;
    submit(formData: CardHolderData, submitParams?: {
        metadata?: Record<string, string>;
    }): void;
    destroy(): void;
}
declare global {
    interface Window {
        NextPayment?: new (options: NextPaymentOptions) => NextPaymentInstance;
    }
}
export declare function cssTextToStyle(css: string): Record<string, string>;
export declare function normalizeNextPaymentError(error: unknown): CardError[];
export declare const CREDENTIALS_TTL_MS: number;
export declare class NextPaymentTokenizer {
    private readonly environmentKey;
    private readonly config?;
    private readonly logger;
    private instance;
    private ready;
    private mounted;
    private pending;
    private fieldErrors;
    private lengths;
    private submitted;
    private loadedAt;
    private refreshing;
    private listeners;
    constructor(environmentKey: string, config?: CardInputConfig | undefined);
    mount(mount: HostedFieldsMount, events: CardTokenizerEvents): Promise<void>;
    tokenize(card: CardHolderData): void;
    focus(field: HostedCardField): void;
    setPlaceholder(_field: HostedCardField, _text: string): void;
    reset(): void;
    destroy(): void;
    private stale;
    private refresh;
    private teardown;
    private create;
    private wasEmpty;
    private settle;
}
export {};
//# sourceMappingURL=next-payment.d.ts.map