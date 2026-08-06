import { FeatureManifest } from '../schema/feature-manifest';
export interface LogEntry {
    level: 'error' | 'warn' | 'info' | 'debug';
    message: string;
    where: string;
    hasContext: boolean;
}
export declare function renderLogs(manifest: FeatureManifest, logs: LogEntry[]): string;
//# sourceMappingURL=render-feature-reference-logs.d.ts.map