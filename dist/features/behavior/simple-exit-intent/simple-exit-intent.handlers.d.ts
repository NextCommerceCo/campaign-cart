import { Logger } from '../../../core/logger';
import { ExitIntentListenerContext, ExitIntentListeners, ExitIntentTriggerContext, ExitIntentTriggerState } from './simple-exit-intent.types';
export declare function isMobileDevice(): boolean;
export declare function shouldTrigger(state: ExitIntentTriggerState): boolean;
export declare function setupEventListeners(ctx: ExitIntentListenerContext): ExitIntentListeners;
export declare function triggerExitIntent(ctx: ExitIntentTriggerContext): void;
export declare function saveToSessionStorage(useSessionStorage: boolean, sessionStorageKey: string, triggerCount: number, lastTriggerTime: number, logger: Logger): void;
//# sourceMappingURL=simple-exit-intent.handlers.d.ts.map