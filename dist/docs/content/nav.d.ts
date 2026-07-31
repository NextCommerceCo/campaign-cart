import { FeatureCategory, FeatureManifest } from '../schema/feature-manifest';
import { StateManifest } from '../schema/state-manifest';
export declare const FEATURE_CATEGORY_LABELS: Record<FeatureCategory, string>;
export declare function navLabel(kebab: string): string;
export declare function featureNavTitle(manifest: FeatureManifest, leaf: string): string;
export declare function featureNav(manifest: FeatureManifest, leaf: string): string;
export declare function stateNavTitle(manifest: StateManifest, leaf: string): string;
export declare function stateNav(manifest: StateManifest, leaf: string): string;
export type CoreSection = 'Reference' | 'Subsystems' | null;
export declare function coreNavTitle(section: CoreSection, leaf: string): string;
export declare function coreNav(section: CoreSection, leaf: string): string;
export declare function referenceNavTitle(leaf: string): string;
export declare function referenceNav(leaf: string, category?: string): string;
//# sourceMappingURL=nav.d.ts.map