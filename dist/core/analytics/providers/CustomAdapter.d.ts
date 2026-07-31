import { ProviderAdapter } from './ProviderAdapter';
import { DataLayerEvent } from '../types';
interface CustomAdapterConfig {
    endpoint?: string;
    headers?: Record<string, string>;
    batchSize?: number;
    batchIntervalMs?: number;
    maxRetries?: number;
    retryDelayMs?: number;
    transformFunction?: (event: DataLayerEvent) => any;
    blockedEvents?: string[];
}
export declare class CustomAdapter extends ProviderAdapter {
    private config;
    private eventQueue;
    private batchTimer;
    private retryQueue;
    constructor(config?: CustomAdapterConfig);
    updateConfig(config: Partial<CustomAdapterConfig>): void;
    protected isReady(): boolean;
    protected getDebugDetails(): Record<string, string | number | boolean>;
    sendEvent(event: DataLayerEvent): unknown;
    private scheduleBatch;
    private sendBatch;
    private sendRequest;
    private addToRetryQueue;
    private scheduleRetry;
    private delay;
    flush(): Promise<void>;
    getQueueSize(): number;
    getRetryQueueSize(): number;
    clearQueue(): void;
}
export {};
//# sourceMappingURL=CustomAdapter.d.ts.map