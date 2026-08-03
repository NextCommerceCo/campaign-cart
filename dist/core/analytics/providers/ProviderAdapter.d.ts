import { AnalyticsProvider, DataLayerEvent } from '../types';
import { Logger } from '../../logger';
import { ProviderDebugInfo } from '../debug/AnalyticsDebugTracker';
export interface ProviderAdapterOptions {
    blockedEvents?: string[];
}
declare const SKIP_TAG = "__analyticsSkip";
export interface SkipResult {
    readonly [SKIP_TAG]: true;
    readonly reason: string;
}
export declare function notSupported(reason?: string): SkipResult;
export declare const NOT_SUPPORTED: SkipResult;
export declare function asSkipResult(result: unknown): SkipResult | null;
export declare class DispatchError extends Error {
    readonly attemptedPayload?: unknown | undefined;
    constructor(message: string, attemptedPayload?: unknown | undefined);
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
export {};
//# sourceMappingURL=ProviderAdapter.d.ts.map