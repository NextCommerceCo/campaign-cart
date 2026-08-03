import { ProviderAdapter } from './ProviderAdapter';
import { DataLayerEvent } from '../types';
declare global {
    interface Window {
        nextCampaign: {
            config: (options: {
                apiKey: string;
            }) => void;
            event: (eventName: string, eventData?: any) => void;
        };
    }
}
export declare class NextCampaignAdapter extends ProviderAdapter {
    private scriptLoaded;
    private scriptLoading;
    private loadPromise;
    private apiKey;
    private loadWarned;
    constructor(config?: {
        blockedEvents?: string[];
    });
    private warnScriptMissing;
    initialize(config?: any): Promise<void>;
    protected isReady(): boolean;
    protected getDebugDetails(): Record<string, string | number | boolean>;
    sendEvent(event: DataLayerEvent): Promise<unknown>;
    private loadScript;
    private performLoad;
    private fireInitialPageView;
    private sendPageView;
    private waitForNextCampaign;
    private mapEvent;
}
//# sourceMappingURL=NextCampaignAdapter.d.ts.map