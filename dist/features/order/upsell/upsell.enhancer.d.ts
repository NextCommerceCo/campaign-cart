import { BaseEnhancer } from '../../../core/base/base-enhancer';
export declare class UpsellEnhancer extends BaseEnhancer {
    private apiClient;
    private clickHandler?;
    private keydownHandler?;
    private pageShowHandler?;
    private pageViewTimer?;
    private loadingOverlay;
    private isProcessingRef;
    private isSelector;
    private currentPagePath?;
    private packageSelectorId?;
    private bundleSelectorId?;
    private state;
    constructor(element: HTMLElement);
    initialize(): Promise<void>;
    private setupPageShowHandler;
    private makeInteractionContext;
    private makeHandlerContext;
    update(): void;
    private bindActionButtons;
    protected cleanupEventListeners(): void;
    destroy(): void;
}
//# sourceMappingURL=upsell.enhancer.d.ts.map