export interface DlEventEntry {
    name: string;
    category: string;
    hasSchema: boolean;
    description: string;
}
export type SharedShape = 'UserProperties' | 'Product';
export interface SchemaField {
    path: string;
    type: string;
    required: boolean;
    sharedShape?: SharedShape;
}
export interface EmitSite {
    file: string;
    line: number;
    how: string;
}
export interface ProviderRegistryEntry {
    key: string;
    requiredSetting?: string;
}
export interface ProviderEventMaps {
    facebook: Record<string, string>;
    facebookCustomEvents: string[];
    rudderstack: Record<string, string>;
    rudderstackSpecialCases: string[];
    nextCampaign: string[];
    gtmEcommerce: string[];
}
export interface AnalyticsExtract {
    events: DlEventEntry[];
    schemas: Record<string, SchemaField[]>;
    shared: Record<SharedShape, SchemaField[]>;
    emitSites: Record<string, EmitSite[]>;
    providers: ProviderRegistryEntry[];
    providerEventMaps: ProviderEventMaps;
}
export declare function extractDlEvents(eventsFile: string): DlEventEntry[];
export declare function extractEventSchemas(schemasFile: string): {
    schemas: Record<string, SchemaField[]>;
    shared: Record<SharedShape, SchemaField[]>;
};
export declare function extractEmitSites(analyticsDir: string, srcRoot: string, extraFiles?: string[]): Record<string, EmitSite[]>;
export declare function extractProviderRegistry(analyticsIndexFile: string): ProviderRegistryEntry[];
export declare function extractProviderEventMaps(providersDir: string): ProviderEventMaps;
export declare function extractAnalytics(srcRoot: string): AnalyticsExtract;
//# sourceMappingURL=extract-analytics-events.d.ts.map