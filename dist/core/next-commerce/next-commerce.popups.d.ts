import { Logger } from '../logger';
export interface PopupsState {
    exitIntentEnhancer: any;
}
export interface ExitIntentOptions {
    image?: string;
    template?: string;
    action?: () => void | Promise<void>;
    disableOnMobile?: boolean;
    mobileScrollTrigger?: boolean;
    maxTriggers?: number;
    useSessionStorage?: boolean;
    sessionStorageKey?: string;
    overlayClosable?: boolean;
    showCloseButton?: boolean;
    imageClickable?: boolean;
    actionButtonText?: string;
}
export declare function exitIntent(ctx: {
    state: PopupsState;
    logger: Logger;
}, options: ExitIntentOptions): Promise<void>;
export declare function disableExitIntent(ctx: {
    state: PopupsState;
}): void;
//# sourceMappingURL=next-commerce.popups.d.ts.map