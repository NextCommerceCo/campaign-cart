import { ProviderAdapter } from './provider-adapter';
import { DataLayerEvent } from '../types';
declare global {
    interface Window {
        rudderanalytics: {
            track: (event: string, properties?: any, options?: any) => void;
            page: (category?: string, name?: string, properties?: any, options?: any) => void;
            identify: (userId: string, traits?: any, options?: any) => void;
            reset: () => void;
            ready: (callback: () => void) => void;
        };
    }
}
export declare class RudderStackAdapter extends ProviderAdapter {
    private pageViewSent;
    private loadWarned;
    constructor(config?: {
        blockedEvents?: string[];
    });
    private warnScriptMissing;
    private isRudderStackLoaded;
    protected isReady(): boolean;
    protected getDebugDetails(): Record<string, string | number | boolean>;
    sendEvent(event: DataLayerEvent): unknown | Promise<unknown>;
    private waitForRudderStack;
    private buildPlan;
    private buildPageViewPlan;
    private buildUserDataPlan;
    private mapEventName;
}
//# sourceMappingURL=rudderstack-adapter.d.ts.map