import { AttributeScanner } from '../attribute-scanner';
export declare class SDKInitializer {
    private static logger;
    private static initialized;
    private static attributeScanner;
    private static retryAttempts;
    private static maxRetries;
    private static attributionCtx;
    static initialize(): Promise<void>;
    private static loadConfiguration;
    private static loadCampaignData;
    private static initializeAnalytics;
    private static initializeErrorHandler;
    private static checkAndLoadOrder;
    private static scanAndEnhanceDOM;
    private static setupReadyCallbacks;
    private static initializeDebugMode;
    static isInitialized(): boolean;
    static reinitialize(): Promise<void>;
    private static waitForDOM;
    private static waitForStoreRehydration;
    private static emitInitializedEvent;
    static getAttributeScanner(): AttributeScanner | null;
    static getInitializationStats(): {
        initialized: boolean;
        retryAttempts: number;
        scannerStats?: ReturnType<AttributeScanner['getStats']>;
    };
}
//# sourceMappingURL=sdk-initializer.d.ts.map