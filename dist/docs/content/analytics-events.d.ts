export type SharedShapeName = 'UserProperties' | 'Product';
export interface AnalyticsEventDoc {
    name: string;
    firesWhen: string;
    fields?: Record<string, string>;
    providerNotes?: string;
    neverFired?: string;
    cautions?: string[];
}
export interface AnalyticsProviderDoc {
    key: string;
    adapter: string;
    summary: string;
    reshaping: string;
    drops: string;
    cautions?: string[];
}
export interface AnalyticsFailureStep {
    stage: string;
    condition: string;
    symptom: string;
    source: string;
    fix: string;
}
export declare const ANALYTICS_EVENTS_INTRO: string;
export declare const ANALYTICS_ENABLE_NOTE: string;
export declare const ANALYTICS_PROVIDERS_INTRO: string;
export declare const ANALYTICS_BLOCKED_EVENTS_NOTE: string[];
export declare const DL_PREFIX_NOTES: string[];
export declare const ANALYTICS_FAILURE_STEPS: AnalyticsFailureStep[];
export declare const ANALYTICS_DEBUG_NOTES: string[];
export declare const ANALYTICS_SHARED_SHAPES: Record<SharedShapeName, {
    summary: string;
    fields: Record<string, string>;
}>;
export declare const ANALYTICS_FIELD_DOCS: Record<string, string>;
export declare const ANALYTICS_EVENT_DOCS: AnalyticsEventDoc[];
export declare const ANALYTICS_PROVIDER_DOCS: AnalyticsProviderDoc[];
//# sourceMappingURL=analytics-events.d.ts.map