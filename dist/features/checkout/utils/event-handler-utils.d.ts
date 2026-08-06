export interface EventBinding {
    element: HTMLElement;
    event: string;
    handler: EventListener;
    options?: AddEventListenerOptions;
}
export declare class EventHandlerManager {
    private handlers;
    private bindings;
    addHandler(element: HTMLElement | null | undefined, event: string, handler: EventListener, options?: AddEventListenerOptions): void;
    addHandlers(bindings: EventBinding[]): void;
    removeHandler(element: HTMLElement | null | undefined, event: string): void;
    removeElementHandlers(element: HTMLElement): void;
    removeAllHandlers(): void;
    addDelegatedHandler(container: HTMLElement, selector: string, event: string, handler: (event: Event, target: HTMLElement) => void): void;
    addDebouncedHandler(element: HTMLElement, event: string, handler: EventListener, delay?: number): void;
    addThrottledHandler(element: HTMLElement, event: string, handler: EventListener, limit?: number): void;
    addOnceHandler(element: HTMLElement, event: string, handler: EventListener): void;
    getActiveBindings(): EventBinding[];
    hasHandler(element: HTMLElement, event: string): boolean;
}
//# sourceMappingURL=event-handler-utils.d.ts.map