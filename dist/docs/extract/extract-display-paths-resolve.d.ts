import { DisplayPath } from './extract-display-paths-routing-table';
export interface ResolvedDisplayPaths {
    paths: DisplayPath[];
    where: string;
    dataFallback?: string;
    prefixSegments?: number;
    formats: Record<string, string>;
    formatsAreTotal: boolean;
    formatsWithoutPath: string[];
    formatWhere: string | undefined;
}
export declare function extractResolvedDisplayPaths(files: Array<[string, string]>, namespace: string): ResolvedDisplayPaths;
//# sourceMappingURL=extract-display-paths-resolve.d.ts.map