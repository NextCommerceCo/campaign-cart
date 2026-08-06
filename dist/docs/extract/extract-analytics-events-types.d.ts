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
    symbol: string;
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
//# sourceMappingURL=extract-analytics-events-types.d.ts.map