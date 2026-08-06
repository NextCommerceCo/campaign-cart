import { FeatureManifest } from '../schema/feature-manifest';
export interface TestedExample {
    title: string;
    html: string;
    fixture: string;
    spec?: string;
}
export declare function renderTestedExample(manifest: FeatureManifest, example: TestedExample): string;
//# sourceMappingURL=render-feature-reference-tested-example.d.ts.map