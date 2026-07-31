export interface TooltipTimers {
    showTimeout: number | null;
    hideTimeout: number | null;
    dismissTimeout: number | null;
}
export declare function cleanupTimeouts(timers: TooltipTimers): void;
export declare function scheduleShow(timers: TooltipTimers, delay: number | undefined, onShow: () => void): void;
export declare function scheduleHide(timers: TooltipTimers, onHide: () => void): void;
export interface TooltipEventHandlers {
    onMouseEnter: () => void;
    onMouseLeave: () => void;
    onFocus: () => void;
    onBlur: () => void;
    onTouchStart: () => void;
    onKeydown: (e: KeyboardEvent) => void;
}
export declare function setupEventListeners(element: HTMLElement, handlers: TooltipEventHandlers): void;
//# sourceMappingURL=tooltip.handlers.d.ts.map