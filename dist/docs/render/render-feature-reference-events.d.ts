import { FeatureManifest } from '../schema/feature-manifest';
export interface EventDoc {
    when?: string;
    fields?: Array<{
        name: string;
        type: string;
        description: string;
    }>;
    example?: string;
}
export declare function renderEvents(manifest: FeatureManifest, eventDocs: Record<string, EventDoc>): string;
//# sourceMappingURL=render-feature-reference-events.d.ts.map