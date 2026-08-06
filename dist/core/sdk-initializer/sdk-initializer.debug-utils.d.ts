import { Logger } from '../logger';
import { AttributeScanner } from '../attribute-scanner';
export declare function setupGlobalDebugUtils(ctx: {
    logger: Logger;
    reinitialize: () => Promise<void>;
    getInitializationStats: () => {
        initialized: boolean;
        retryAttempts: number;
        scannerStats?: ReturnType<AttributeScanner['getStats']>;
    };
}): void;
//# sourceMappingURL=sdk-initializer.debug-utils.d.ts.map