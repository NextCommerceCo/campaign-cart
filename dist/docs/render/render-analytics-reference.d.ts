import { AnalyticsEventDoc, AnalyticsProviderDoc } from '../content/analytics-events';
export interface SchemaFieldFact {
    path: string;
    type: string;
    required: boolean;
    sharedShape?: string;
}
export interface EmitSiteFact {
    file: string;
    symbol: string;
    how: string;
}
export interface AnalyticsFacts {
    events: Array<{
        name: string;
        category: string;
        hasSchema: boolean;
        description: string;
    }>;
    schemas: Record<string, SchemaFieldFact[]>;
    shared: Record<string, SchemaFieldFact[]>;
    emitSites: Record<string, EmitSiteFact[]>;
    providers: Array<{
        key: string;
        requiredSetting?: string;
    }>;
    providerEventMaps: {
        facebook: Record<string, string>;
        facebookCustomEvents: string[];
        rudderstack: Record<string, string>;
        rudderstackSpecialCases: string[];
        nextCampaign: string[];
        gtmEcommerce: string[];
    };
}
export declare function renderAnalyticsEvents(facts: AnalyticsFacts, docs: AnalyticsEventDoc[]): string;
export declare function renderAnalyticsProviders(facts: AnalyticsFacts, docs: AnalyticsProviderDoc[]): string;
//# sourceMappingURL=render-analytics-reference.d.ts.map