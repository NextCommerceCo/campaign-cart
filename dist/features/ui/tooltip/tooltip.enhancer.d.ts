import { BaseEnhancer } from '../../../core/base/base-enhancer';
export type { TooltipConfig } from './tooltip.types';
export declare class TooltipEnhancer extends BaseEnhancer {
    private tooltip;
    private arrow;
    private timers;
    private config;
    private isVisible;
    constructor(element: HTMLElement);
    initialize(): Promise<void>;
    update(): void;
    destroy(): void;
    protected cleanupEventListeners(): void;
    private handleMouseEnter;
    private handleMouseLeave;
    private handleFocus;
    private handleBlur;
    private handleTouchStart;
    private handleKeydown;
    private finalizeStaleDismissal;
    private show;
    private hide;
}
//# sourceMappingURL=tooltip.enhancer.d.ts.map