export declare class AttributeScanner {
    private logger;
    private enhancers;
    private enhancedElements;
    private enhancerCount;
    private domObserver;
    private isScanning;
    private isDestroyed;
    private scanQueue;
    private queueTimer;
    private detachedSweepScheduled;
    private enhancerStats;
    private isDebugMode;
    constructor();
    scanAndEnhance(root: Element): Promise<void>;
    private enhanceElement;
    private createEnhancer;
    private startObserving;
    private handleDOMChange;
    private scheduleDetachedSweep;
    private cleanupDetachedElements;
    private queueElementForEnhancement;
    private processQueueDebounced;
    private processQueue;
    private cleanupElement;
    private destroyEnhancers;
    destroy(): void;
    pause(): void;
    resume(root?: Element): void;
    getStats(): {
        enhancedElements: number;
        queuedElements: number;
        isObserving: boolean;
        isScanning: boolean;
        performanceStats?: Record<string, {
            totalTime: number;
            averageTime: number;
            count: number;
        }>;
    };
}
//# sourceMappingURL=attribute-scanner.d.ts.map