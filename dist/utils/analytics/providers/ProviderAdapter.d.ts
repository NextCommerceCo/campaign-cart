import { AnalyticsProvider, DataLayerEvent } from '../types';
import { Logger } from '../../logger';
import { ProviderDebugInfo } from '../debug/AnalyticsDebugTracker';
export interface ProviderAdapterOptions {
    blockedEvents?: string[];
}
export declare abstract class ProviderAdapter implements AnalyticsProvider {
    readonly name: string;
    enabled: boolean;
    protected blockedEvents: string[];
    protected logger: Logger;
    constructor(name: string, options?: ProviderAdapterOptions);
    setEnabled(enabled: boolean): void;
    isEnabled(): boolean;
    initialize(_config?: unknown): Promise<void>;
    protected shouldTrack(event: DataLayerEvent): boolean;
    trackEvent(event: DataLayerEvent): void;
    abstract sendEvent(event: DataLayerEvent): unknown | Promise<unknown>;
    protected isReady(): boolean;
    protected getDebugDetails(): Record<string, string | number | boolean>;
    getDebugInfo(): ProviderDebugInfo;
    protected transformEvent(event: DataLayerEvent): any;
    protected debug(message: string, data?: any): void;
    protected isBrowser(): boolean;
    protected getNestedProperty(obj: any, path: string): any;
    protected formatCurrency(value: number): string;
    protected extractEcommerceData(event: DataLayerEvent): any;
}
//# sourceMappingURL=ProviderAdapter.d.ts.map