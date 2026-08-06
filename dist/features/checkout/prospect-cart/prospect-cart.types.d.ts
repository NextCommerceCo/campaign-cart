import { Logger } from '../../../core/logger';
import { IApiClient } from '../../../api/client.types';
export interface ProspectCartConfig {
    autoCreate?: boolean;
    triggerOn?: 'formStart' | 'emailEntry' | 'phoneEntry' | 'emailAndPhone' | 'manual';
    emailField?: string;
    phoneField?: string;
    includeUtmData?: boolean;
    sessionTimeout?: number;
    minPhoneDigits?: number;
}
export interface ProspectCart {
    id: string;
    prospect_id: string;
    email?: string;
    created_at: string;
    expires_at: string;
    utm_data?: Record<string, string>;
    cart_data?: any;
}
export interface FieldDiscoveryContext {
    element: HTMLElement;
    logger: Logger;
}
export interface PhoneValidationContext {
    phoneField: HTMLInputElement | undefined;
    minPhoneDigits: number | undefined;
    logger: Logger;
}
export interface TimeoutRef {
    value: number | undefined;
}
export interface HasTriggeredRef {
    value: boolean;
}
export interface TriggerContext {
    element: HTMLElement;
    emailField: HTMLInputElement | undefined;
    phoneField: HTMLInputElement | undefined;
    logger: Logger;
    phoneBlurTimeoutRef: TimeoutRef;
    hasTriggeredRef: HasTriggeredRef;
    signal: AbortSignal;
    isValidPhone: (phone: string) => boolean;
    checkAndCreateCart: () => void;
    createProspectCart: () => Promise<void>;
}
export interface ProspectCartRef {
    value: ProspectCart | undefined;
}
export interface CartCreationContext {
    apiClient: IApiClient;
    element: HTMLElement;
    emailField: HTMLInputElement | undefined;
    config: ProspectCartConfig;
    logger: Logger;
    prospectCartRef: ProspectCartRef;
    emitProspectEvent: (type: string, data?: any) => void;
    getFormattedPhoneNumber: () => string;
    isValidEmail: (email: string) => boolean;
    isValidPhone: (phone: string) => boolean;
}
//# sourceMappingURL=prospect-cart.types.d.ts.map