import { EventBus } from '../../events';
export interface EventDebounceConfig {
    [eventName: string]: number;
}
export interface AutoEventListenerContext {
    eventBus: EventBus;
    eventHandlers: Map<string, Function>;
    shouldProcessEvent(eventName: string): boolean;
    waitForCartCalculation(timeoutMs?: number): Promise<void>;
}
//# sourceMappingURL=auto-event-listener.types.d.ts.map