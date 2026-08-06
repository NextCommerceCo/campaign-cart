import { DisplayPathsDoc, FeatureManifest } from '../schema/feature-manifest';
import { DisplayPath } from '../extract/extract-display-paths';
export type { DisplayPath };
export interface DisplayPathSource {
    paths: DisplayPath[];
    where?: string;
    unanswered?: Array<{
        name: string;
        routedTo: string;
        instead: string;
        hasFallback: boolean;
    }>;
    claimedIn?: string;
}
export declare function renderDisplayPaths(manifest: FeatureManifest, source: DisplayPathSource, namespace?: string, doc?: DisplayPathsDoc | undefined, leaf?: string): string;
//# sourceMappingURL=render-feature-reference-display-paths.d.ts.map