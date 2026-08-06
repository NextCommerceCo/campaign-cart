import { EventBus } from '../../events';
import { AutoEventListenerContext, EventDebounceConfig } from './auto-event-listener.types';
export declare class AutoEventListener implements AutoEventListenerContext {
    private static instance;
    eventBus: EventBus;
    private isInitialized;
    eventHandlers: Map<string, Function>;
    private lastEventTimes;
    private debounceConfig;
    private constructor();
    static getInstance(): AutoEventListener;
    initialize(): void;
    shouldProcessEvent(eventName: string): boolean;
    waitForCartCalculation(timeoutMs?: number): Promise<void>;
    reset(): void;
    destroy(): void;
    getStatus(): {
        initialized: boolean;
        listenersCount: number;
        debounceConfig: EventDebounceConfig;
    };
    setDebounceConfig(config: Partial<EventDebounceConfig>): void;
}
//# sourceMappingURL=auto-event-listener.d.ts.map