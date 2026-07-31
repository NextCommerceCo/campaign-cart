import { Logger } from '../../../core/logger';
import { BundleCard } from './bundle-selector.types';
export interface ForceBundleSpec {
    selectorId: string | null;
    bundleId: string;
}
export declare function parseForceBundleId(raw: string | null | undefined): ForceBundleSpec[];
export declare function resolveForcedBundleId(specs: ForceBundleSpec[], selectorId: string | null): string | null;
export interface DefaultCardChoice {
    card: BundleCard | null;
    fromForce: boolean;
    forcedMiss: string | null;
    usedFirstCardFallback: boolean;
}
export declare function pickDefaultCard(cards: BundleCard[], rawForceBundleId: string | null | undefined, selectorId: string | null): DefaultCardChoice;
export declare function pickAndLogDefaultCard(cards: BundleCard[], selectorId: string | null, logger: Logger): BundleCard | null;
//# sourceMappingURL=bundle-selector.selection-state.d.ts.map