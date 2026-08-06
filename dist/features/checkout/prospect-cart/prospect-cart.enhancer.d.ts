import { BaseEnhancer } from '../../../core/base/base-enhancer';
import { ProspectCartConfig, ProspectCart } from './prospect-cart.types';
export type { ProspectCartConfig, ProspectCart };
export declare class ProspectCartEnhancer extends BaseEnhancer {
    private config;
    private apiClient;
    private prospectCartRef;
    private emailField?;
    private phoneField?;
    private hasTriggeredRef;
    private domListenerAbort;
    initialize(): Promise<void>;
    update(data?: any): void;
    protected cleanupEventListeners(): void;
    private makeTriggerContext;
    private makeCartCreationContext;
    private getFormattedPhoneNumber;
    private isValidEmail;
    private isValidPhone;
    private isValidName;
    private createProspectCart;
    private updateProspectCart;
    private collectUtmData;
    private getCurrency;
    private checkExistingProspectCart;
    private handleCartUpdate;
    private updateTimeout;
    private emitProspectEvent;
    createCartManually(): Promise<ProspectCart | null>;
    getCurrentProspectCart(): ProspectCart | null;
    abandonCart(): Promise<void>;
    convertCart(): Promise<void>;
    updateEmail(email: string): void;
    private phoneBlurTimeoutRef;
    checkAndCreateCart(): void;
}
//# sourceMappingURL=prospect-cart.enhancer.d.ts.map