import { Logger } from '../../../core/logger';
import { EventMap } from '../../../types/global';
export interface SimpleExitIntentOptions {
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
export interface ExitIntentEmit {
    (event: 'exit-intent:shown', detail: EventMap['exit-intent:shown']): void;
    (event: 'exit-intent:clicked', detail: EventMap['exit-intent:clicked']): void;
    (event: 'exit-intent:dismissed', detail: EventMap['exit-intent:dismissed']): void;
    (event: 'exit-intent:closed', detail: EventMap['exit-intent:closed']): void;
    (event: 'exit-intent:action', detail: EventMap['exit-intent:action']): void;
}
export interface ExitIntentTriggerState {
    isEnabled: boolean;
    hasPopup: boolean;
    triggerCount: number;
    maxTriggers: number;
    lastTriggerTime: number;
    cooldownPeriod: number;
    disableOnMobile: boolean;
}
export interface ExitIntentSessionData {
    triggerCount: number;
    lastTriggerTime: number;
    timestamp: number;
}
export interface ExitIntentListeners {
    mouseLeaveHandler: ((e: MouseEvent) => void) | null;
    scrollHandler: ((e: Event) => void) | null;
}
export interface ExitIntentListenerContext {
    mobileScrollTrigger: boolean;
    getTriggerState: () => ExitIntentTriggerState;
    triggerExitIntent: () => void;
}
export interface ExitIntentTriggerContext {
    incrementTriggerCount: () => void;
    setLastTriggerTime: (time: number) => void;
    saveToSessionStorage: () => void;
    showPopup: () => void;
}
export interface ExitIntentPopupContext {
    imageUrl: string;
    templateName: string;
    templateElement: HTMLTemplateElement | null;
    action: (() => void | Promise<void>) | null;
    overlayClosable: boolean;
    showCloseButton: boolean;
    imageClickable: boolean;
    actionButtonText: string;
    logger: Logger;
    emit: ExitIntentEmit;
    hidePopup: () => void;
    saveToSessionStorage: () => void;
}
export interface ExitIntentPopupElements {
    popupElement: HTMLElement;
    overlayElement: HTMLElement;
}
//# sourceMappingURL=simple-exit-intent.types.d.ts.map