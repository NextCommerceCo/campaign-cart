interface ViewItemConfig {
    packageId: string;
    trigger?: string;
    fromUrl?: boolean;
}
interface MetaTagConfig {
    disabledEvents: string[];
    enabledOnlyEvents: string[];
    listContext: {
        id?: string;
        name?: string;
    };
    viewItem?: ViewItemConfig;
    viewItemListPackageIds: string[];
    scrollThresholds: number[];
}
export declare class MetaTagController {
    private static instance;
    private config;
    private initialized;
    private viewItemFired;
    private viewItemListFired;
    private reachedScrollThresholds;
    private constructor();
    static getInstance(): MetaTagController;
    initialize(): void;
    shouldBlockEvent(eventName: string): boolean;
    hasMetaTagOverride(eventName: string): boolean;
    wasViewItemFired(): boolean;
    wasViewItemListFired(): boolean;
    getListContext(): {
        id?: string;
        name?: string;
    };
    private parseViewItemConfig;
    private parseViewItemListConfig;
    private fireViewItemEvent;
    private fireViewItemListEvent;
    private parseListContext;
    private parseArray;
    private parseScrollThresholds;
    private setupScrollTracking;
    private getMeta;
    reset(): void;
    getStatus(): {
        initialized: boolean;
        config: MetaTagConfig;
        viewItemFired: boolean;
        viewItemListFired: boolean;
        scrollThresholdsReached: number[];
    };
}
export declare const metaTagController: MetaTagController;
export {};
//# sourceMappingURL=MetaTagController.d.ts.map