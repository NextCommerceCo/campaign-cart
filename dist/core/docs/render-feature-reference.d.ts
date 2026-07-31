import { FeatureManifest } from './feature-manifest';
export interface DisplayPath {
    name: string;
    format: string;
    negated: boolean;
}
export interface EventDoc {
    when?: string;
    fields?: Array<{
        name: string;
        type: string;
        description: string;
    }>;
    example?: string;
}
export declare function renderDisplayPaths(manifest: FeatureManifest, displayPaths?: Record<string, DisplayPath[]>): string;
export declare function renderGetStarted(manifest: FeatureManifest, all: FeatureManifest[], example: TestedExample | undefined, initLog: string | undefined): string;
export declare function renderRelations(manifest: FeatureManifest, all: FeatureManifest[]): string;
export declare function renderErrors(manifest: FeatureManifest): string;
export interface LogEntry {
    level: 'error' | 'warn' | 'info' | 'debug';
    message: string;
    where: string;
    hasContext: boolean;
}
export declare function renderLogs(manifest: FeatureManifest, logs: LogEntry[]): string;
export interface TestedExample {
    title: string;
    html: string;
    fixture: string;
    spec?: string;
}
export declare function renderTestedExample(manifest: FeatureManifest, example: TestedExample): string;
export declare function renderAttributes(manifest: FeatureManifest): string;
export declare function renderEvents(manifest: FeatureManifest, eventDocs: Record<string, EventDoc>): string;
//# sourceMappingURL=render-feature-reference.d.ts.map